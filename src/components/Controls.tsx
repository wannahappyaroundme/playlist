import type { RepeatMode } from '../types';
import {
  PrevIcon,
  NextIcon,
  PlayIcon,
  PauseIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
} from './icons';

interface ControlsProps {
  isPlaying: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  progress: number;
  duration: number;
  onToggle(): void;
  onNext(): void;
  onPrev(): void;
  onSeek(sec: number): void;
  onCycleRepeat(): void;
  onToggleShuffle(): void;
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

export default function Controls({
  isPlaying,
  repeat,
  shuffle,
  progress,
  duration,
  onToggle,
  onNext,
  onPrev,
  onSeek,
  onCycleRepeat,
  onToggleShuffle,
}: ControlsProps) {
  const max = Number.isFinite(duration) && duration > 0 ? duration : 0;

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl bg-black/30 px-5 py-4 backdrop-blur-md ring-1 ring-white/15">
      {/* progress bar */}
      <div
        className="flex items-center gap-3 text-xs text-white/85"
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
      <div className="flex items-center justify-center gap-4 sm:gap-6">
        <button
          type="button"
          data-testid="shuffle-btn"
          aria-pressed={shuffle}
          aria-label="shuffle"
          onClick={onToggleShuffle}
          className={
            'mr-2 flex h-10 w-10 items-center justify-center rounded-full text-white transition ' +
            (shuffle ? 'bg-white/20 ring-1 ring-white/40' : 'hover:bg-white/10')
          }
        >
          <ShuffleIcon className="h-5 w-5" />
        </button>

        <button
          type="button"
          aria-label="prev"
          onClick={onPrev}
          className="flex h-12 w-12 items-center justify-center rounded-full text-white transition hover:bg-white/10 active:scale-90"
        >
          <PrevIcon className="h-7 w-7" />
        </button>

        <button
          type="button"
          aria-label={isPlaying ? 'pause' : 'play'}
          onClick={onToggle}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black transition active:scale-95"
        >
          {isPlaying ? (
            <PauseIcon className="h-7 w-7" />
          ) : (
            <PlayIcon className="ml-0.5 h-7 w-7" />
          )}
        </button>

        <button
          type="button"
          aria-label="next"
          onClick={onNext}
          className="flex h-12 w-12 items-center justify-center rounded-full text-white transition hover:bg-white/10 active:scale-90"
        >
          <NextIcon className="h-7 w-7" />
        </button>

        <button
          type="button"
          data-testid="repeat-btn"
          data-mode={repeat}
          aria-pressed={repeat !== 'off'}
          aria-label={repeatLabel(repeat)}
          onClick={onCycleRepeat}
          className={
            'ml-2 flex h-10 w-10 items-center justify-center rounded-full text-white transition ' +
            (repeat === 'off' ? 'hover:bg-white/10' : 'bg-white/20 ring-1 ring-white/40')
          }
        >
          {repeat === 'one' ? (
            <RepeatOneIcon className="h-5 w-5" />
          ) : (
            <RepeatIcon className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}
