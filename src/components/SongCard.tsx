import type { Song } from '../types';

interface SongCardProps {
  song: Song;
  active?: boolean;
  onClick?(): void;
}

export default function SongCard({ song, active = false, onClick }: SongCardProps) {
  const synced = song.lyrics.type === 'synced';
  return (
    <button
      type="button"
      data-testid="song-card"
      data-active={String(active)}
      onClick={onClick}
      className={
        'flex w-full items-center gap-3 rounded-xl bg-white/5 p-2 text-left transition hover:bg-white/10 ' +
        (active ? 'ring-2 ring-[var(--c3,#7755ff)] bg-white/10' : 'ring-1 ring-white/5')
      }
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10">
        <img src={song.cover} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{song.title}</p>
        <p className="truncate text-xs text-white/60">{song.artist}</p>
      </div>
      <span
        data-testid="lyric-badge"
        className={
          'shrink-0 rounded-full px-2 py-0.5 text-[10px] ' +
          (synced ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/10 text-white/50')
        }
      >
        {synced ? '싱크가사' : '가사 없음'}
      </span>
    </button>
  );
}
