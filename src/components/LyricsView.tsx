import type { SongLyrics } from '../types';

interface LyricsViewProps {
  lyrics: SongLyrics;
  activeIndex: number;
}

const LINE_HEIGHT_EM = 3.2; // approximate per-line block height in em

function opacityForDistance(d: number): number {
  if (d === 0) return 1;
  if (d === 1) return 0.55;
  if (d === 2) return 0.28;
  return 0.14;
}

export default function LyricsView({ lyrics, activeIndex }: LyricsViewProps) {
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
  const translateY = -(safeIndex * LINE_HEIGHT_EM);

  return (
    <div
      className="relative h-full overflow-hidden"
      style={{
        maskImage:
          'linear-gradient(180deg, transparent 0%, #000 18%, #000 82%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(180deg, transparent 0%, #000 18%, #000 82%, transparent 100%)',
      }}
    >
      <div
        data-testid="lyrics-track"
        className="flex flex-col items-center justify-start transition-transform duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          transform: `translateY(calc(50% + ${translateY}em))`,
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
                'flex min-h-[3.2em] items-center px-4 text-center text-2xl transition-all duration-300 ' +
                (isActive ? 'scale-105 font-semibold text-white' : 'text-white')
              }
              style={{ opacity: opacityForDistance(dist) }}
            >
              {line.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}
