import type { RepeatMode } from '../types';

interface ControlsProps {
  isPlaying: boolean;
  repeat: RepeatMode;
  progress: number;
  duration: number;
  onToggle(): void;
  onNext(): void;
  onPrev(): void;
  onSeek(sec: number): void;
  onCycleRepeat(): void;
}

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function repeatLabel(mode: RepeatMode): string {
  if (mode === 'all') return 'repeat all';
  if (mode === 'one') return 'repeat one';
  return 'repeat off';
}

function repeatIcon(mode: RepeatMode): string {
  if (mode === 'one') return '🔂';
  return '🔁';
}

export default function Controls({
  isPlaying,
  repeat,
  progress,
  duration,
  onToggle,
  onNext,
  onPrev,
  onSeek,
  onCycleRepeat,
}: ControlsProps) {
  const max = Number.isFinite(duration) && duration > 0 ? duration : 0;

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl bg-white/5 px-5 py-4 backdrop-blur-md ring-1 ring-white/10">
      {/* progress bar */}
      <div
        className="flex items-center gap-3 text-xs text-white/70"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        <span>{formatTime(progress)}</span>
        <input
          type="range"
          aria-label="seek"
          min={0}
          max={max}
          step={1}
          value={Math.min(progress, max)}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-[var(--c3,#7755ff)]"
        />
        <span>{formatTime(duration)}</span>
      </div>

      {/* transport */}
      <div className="flex items-center justify-center gap-6">
        <button
          type="button"
          aria-label="prev"
          onClick={onPrev}
          className="text-2xl text-white/80 transition hover:text-white active:scale-90"
        >
          ⏮
        </button>

        <button
          type="button"
          aria-label={isPlaying ? 'pause' : 'play'}
          onClick={onToggle}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black transition active:scale-95"
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true">
              <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="ml-0.5 h-7 w-7 fill-current" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <button
          type="button"
          aria-label="next"
          onClick={onNext}
          className="text-2xl text-white/80 transition hover:text-white active:scale-90"
        >
          ⏭
        </button>

        <button
          type="button"
          data-testid="repeat-btn"
          data-mode={repeat}
          aria-pressed={repeat !== 'off'}
          aria-label={repeatLabel(repeat)}
          onClick={onCycleRepeat}
          className={
            'ml-2 flex h-10 w-10 items-center justify-center rounded-full text-lg transition ' +
            (repeat === 'off'
              ? 'text-white/40 hover:text-white/70'
              : 'bg-white/15 text-white ring-1 ring-white/30')
          }
        >
          {repeatIcon(repeat)}
        </button>
      </div>
    </div>
  );
}
