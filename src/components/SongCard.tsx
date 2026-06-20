import type { Song } from '../types';
import { fallbackCoverSrc } from '../lib/youtube';

interface SongCardProps {
  song: Song;
  active?: boolean;
  onClick?(): void;
  /** 제공되면 카드 위에 "이 곡만 보내기" 액션을 노출(이 한 곡만 공유). */
  onShare?(): void;
}

export default function SongCard({ song, active = false, onClick, onShare }: SongCardProps) {
  const synced = song.lyrics.type === 'synced';
  // <button> 안에 <button> 중첩은 잘못된 마크업 → 공유 버튼은 카드의 형제(인라인 flex)로 둬
  // 배지와 겹치지 않게 나란히 배치한다.
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        data-testid="song-card"
        data-active={String(active)}
        onClick={onClick}
        className={
          'flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-white/5 p-2 text-left transition hover:bg-white/10 ' +
          (active ? 'ring-2 ring-[var(--c3,#7755ff)] bg-white/10' : 'ring-1 ring-white/5')
        }
      >
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10">
          <img
            src={song.cover}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => fallbackCoverSrc(e.currentTarget)}
          />
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
      {onShare ? (
        <button
          type="button"
          aria-label="이 곡만 보내기"
          onClick={onShare}
          className="shrink-0 whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-[11px] text-white/80 transition hover:bg-white/20"
        >
          이 곡만 보내기
        </button>
      ) : null}
    </div>
  );
}
