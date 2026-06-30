import { useEffect, useRef } from 'react';
import { fallbackCoverSrc } from '../lib/youtube';

interface LpDiscProps {
  cover: string;
  spinning: boolean;
  accent: string;
  /** 가사 없이 단독으로 가운데 띄울 때 더 크게(여전히 viewport 비례). */
  big?: boolean;
}

const SPIN_DURATION_MS = 5000;
const RATE_RAMP_MS = 800;

export default function LpDisc({ cover, spinning, accent, big = false }: LpDiscProps) {
  const vinylRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);

  // prefers-reduced-motion guard (jsdom-safe)
  const reduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const el = vinylRef.current;
    if (!el || typeof el.animate !== 'function') return; // jsdom: no WAAPI
    if (reduced) return;
    if (!animRef.current) {
      animRef.current = el.animate(
        [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
        { duration: SPIN_DURATION_MS, iterations: Infinity, easing: 'linear' }
      );
      animRef.current.playbackRate = 0;
    }
    const anim = animRef.current;
    const target = spinning ? 1 : 0;
    // inertial spin-up/down: interpolate playbackRate with rAF
    const start = performance.now();
    const from = anim.playbackRate;
    let raf = 0;
    const tick = (now: number) => {
      // rAF 타임스탬프가 직전 performance.now()보다 작을 수 있어(같은 프레임) k가 음수가 되면
      // eased<0 → playbackRate가 음수가 되고, 무한 애니메이션을 음수 속도로 play()하면
      // InvalidStateError가 난다. k를 [0,1]로 클램프하고 양수일 때만 재생한다.
      const k = Math.min(1, Math.max(0, (now - start) / RATE_RAMP_MS));
      const eased = 1 - Math.pow(1 - k, 3); // easeOutCubic
      anim.playbackRate = Math.max(0, from + (target - from) * eased);
      if (spinning && anim.playbackRate > 0) anim.play();
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spinning, reduced]);

  useEffect(
    () => () => {
      animRef.current?.cancel();
    },
    []
  );

  // Spec §7: cover (square) and vinyl (circle) share the SAME diameter D, placed
  // side by side, with the vinyl slid LEFT over the cover by --lp-overlap (42%).
  // Container width = D + D - overlap*D = D*(2 - 0.42). Each piece is D wide, so
  // its width fraction of the container = 1 / (2 - overlap). With overlap 0.42 →
  // ~63.3%, leaving the cover's left ~58% (of its own width) visible as the sleeve.
  return (
    <div
      className={
        // w-full(셀 너비 = viewport - 좌우패딩, 이미 기기 너비에 비례) + px 상한 + mx-auto
        // → 좌우 여백으로 항상 정중앙, 좁은 화면에서도 절대 넘치지 않고 비례 축소된다.
        'relative w-full mx-auto select-none ' +
        (big ? 'max-w-[560px] lg:max-w-[760px]' : 'max-w-[420px] lg:max-w-[640px]')
      }
      style={{
        // 2 - overlap as an aspect-ratio width:height (height == D == one piece)
        aspectRatio: `calc(2 - var(--lp-overlap, 42%) / 100%) / 1`,
        // expose the per-piece diameter as a fraction of the container width
        ['--lp-piece' as string]: 'calc(1 / (2 - var(--lp-overlap, 42%) / 100%) * 100%)',
      }}
    >
      {/* glow halo behind, tinted by accent */}
      <div
        data-testid="lp-glow"
        className="absolute inset-0 rounded-3xl blur-2xl opacity-40 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 50%, ${accent} 0%, transparent 70%)` }}
      />
      {/* square album cover (sleeve) on the left — same diameter as the vinyl */}
      <div
        data-testid="lp-cover"
        className="absolute left-0 top-0 h-full aspect-square rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10"
        style={{ width: 'var(--lp-piece)' }}
      >
        <img
          src={cover}
          alt="album cover"
          className="h-full w-full object-cover"
          onError={(e) => fallbackCoverSrc(e.currentTarget)}
        />
      </div>
      {/* LP vinyl: same diameter, anchored right, overlapping the cover by 42% */}
      <div
        data-testid="lp-vinyl"
        data-spinning={String(spinning)}
        ref={vinylRef}
        className="absolute top-0 right-0 h-full aspect-square rounded-full shadow-2xl ring-1 ring-black/40"
        style={{
          width: 'var(--lp-piece)',
          background: [
            'repeating-radial-gradient(circle at 50% 50%, #0a0a0a 0px, #0a0a0a 1px, #171717 2px, #0a0a0a 3px)',
            'conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,0.06), rgba(255,255,255,0) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0) 75%, rgba(255,255,255,0.06) 100%)',
          ].join(','),
          backgroundBlendMode: 'screen',
          willChange: 'transform',
        }}
      >
        {/* center label = cover at 32% diameter */}
        <div className="absolute left-1/2 top-1/2 h-[32%] w-[32%] -translate-x-1/2 -translate-y-1/2 rounded-full overflow-hidden ring-2 ring-black/60">
          <img
            src={cover}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
            onError={(e) => fallbackCoverSrc(e.currentTarget)}
          />
        </div>
        {/* spindle hole */}
        <div className="absolute left-1/2 top-1/2 h-[3%] w-[3%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-300/80" />
      </div>
    </div>
  );
}
