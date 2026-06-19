import type { SongColors } from '../types';

interface PlayGateProps {
  cover: string;
  colors: SongColors;
  message?: string;
  onPlay(): void;
}

export default function PlayGate({ cover, colors, message, onPlay }: PlayGateProps) {
  return (
    <div
      className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-8 px-6 text-center"
      style={{
        backgroundImage: `radial-gradient(120% 100% at 50% 30%, ${colors.gradientFrom} 0%, ${colors.gradientTo} 80%)`,
      }}
    >
      <div className="h-36 w-36 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
        <img src={cover} alt="album cover" className="h-full w-full object-cover" />
      </div>

      {message ? (
        <p data-testid="gate-message" className="max-w-md text-lg text-white/85">
          {message}
        </p>
      ) : null}

      <button
        type="button"
        aria-label="play"
        onClick={onPlay}
        className="group relative flex h-24 w-24 items-center justify-center rounded-full bg-white/10 backdrop-blur transition-transform active:scale-95 motion-safe:animate-pulse"
        style={{ boxShadow: `0 0 48px 4px ${colors.accent}` }}
      >
        <span
          className="absolute inset-0 rounded-full opacity-60"
          style={{ background: `radial-gradient(circle, ${colors.accent} 0%, transparent 70%)` }}
          aria-hidden="true"
        />
        {/* play triangle */}
        <svg viewBox="0 0 24 24" className="relative ml-1 h-10 w-10 fill-white" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
    </div>
  );
}
