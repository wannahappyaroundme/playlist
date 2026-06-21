import { useEffect, useRef } from 'react';
import { fallbackCoverSrc } from '../lib/youtube';

interface LpDiscProps {
  cover: string;
  spinning: boolean;
  accent: string;
}

const SPIN_DURATION_MS = 5000;
const RATE_RAMP_MS = 800;

export default function LpDisc({ cover, spinning, accent }: LpDiscProps) {
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
      const k = Math.min(1, (now - start) / RATE_RAMP_MS);
      const eased = 1 - Math.pow(1 - k, 3); // easeOutCubic
      anim.playbackRate = from + (target - from) * eased;
      if (spinning) anim.play();
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
      className="relative w-full max-w-[min(84vw,420px)] lg:max-w-[min(82vmin,680px)] mx-auto select-none"
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
