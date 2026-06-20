import type { SongLyrics } from '../types';

interface LyricsViewProps {
  lyrics: SongLyrics;
  activeIndex: number;
  /** 곡의 추출색(accent). 활성 줄에 은은한 글로우를 입힌다(spec §7). */
  accent?: string;
}

const LINE_HEIGHT_EM = 3.2; // approximate per-line block height in em

function opacityForDistance(d: number): number {
  if (d === 0) return 1;
  if (d === 1) return 0.55;
  if (d === 2) return 0.28;
  return 0.14;
}

export default function LyricsView({ lyrics, activeIndex, accent }: LyricsViewProps) {
  // 글로우는 모션이 아니라 빛 효과지만, reduced-motion 사용자에겐 더 차분하게(spec §7).
  const reduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const glow = accent && !reduced ? `0 0 24px ${accent}` : undefined;
  if (lyrics.type === 'none' || (lyrics.type === 'synced' && !lyrics.synced?.length)) {
    return (
      <div
        data-testid="lyrics-none"
        className="flex h-full flex-col items-center justify-center gap-4 text-center text-white/60"
      >
        <span className="text-4xl animate-pulse" aria-hidden="true">
          ♪
        </span>
        <p className="text-sm">가사를 찾지 못했어요</p>
      </div>
    );
  }

  if (lyrics.type === 'plain') {
    return (
      <div className="relative h-full overflow-y-auto px-2 py-8">
        <span
          data-testid="lyrics-badge"
          className="sticky top-0 inline-block rounded-full bg-white/10 px-3 py-1 text-xs text-white/70 backdrop-blur"
        >
          동기화 아님
        </span>
        <pre className="mt-4 whitespace-pre-wrap font-sans text-lg leading-relaxed text-white/80">
          {lyrics.plain ?? ''}
        </pre>
      </div>
    );
  }

  const lines = lyrics.synced ?? [];
  // activeIndex of -1 (before first line / no synced) keeps the first line centered.
  const safeIndex = activeIndex < 0 ? 0 : activeIndex;
  // The track is absolutely positioned with its top edge at the pane's vertical
  // center (top-1/2). Shift it UP by the active line's center offset so the active
  // line sits exactly at the pane center. Because the track is absolute, its full
  // (tall) height never inflates the bounded pane — overflow-hidden clips it.
  const shiftEm = safeIndex * LINE_HEIGHT_EM + LINE_HEIGHT_EM / 2;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        maskImage:
          'linear-gradient(180deg, transparent 0%, #000 18%, #000 82%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(180deg, transparent 0%, #000 18%, #000 82%, transparent 100%)',
      }}
    >
      <div
        data-testid="lyrics-track"
        className="absolute inset-x-0 top-1/2 flex flex-col items-center motion-safe:transition-transform motion-safe:duration-[450ms] motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          transform: `translateY(-${shiftEm}em)`,
          willChange: 'transform',
        }}
      >
        {lines.map((line, i) => {
          const dist = Math.abs(i - activeIndex);
          const isActive = i === activeIndex;
          return (
            <p
              key={`${line.time}-${i}`}
              data-active={String(isActive)}
              className={
                'flex min-h-[3.2em] items-center px-4 text-center text-2xl motion-safe:transition-all motion-safe:duration-300 ' +
                (isActive ? 'motion-safe:scale-105 font-semibold text-white' : 'text-white')
              }
              style={{
                opacity: opacityForDistance(dist),
                ...(isActive && glow ? { textShadow: glow } : null),
              }}
            >
              {line.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}
