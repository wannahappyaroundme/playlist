import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPlaylist, savePlaylist, getSong } from '../lib/storage';
import { buildSharePayload } from '../lib/share';
import PasteInput from '../components/PasteInput';
import SongCard from '../components/SongCard';
import QrShare from '../components/QrShare';
import AppBackground from '../components/AppBackground';
import type { Song, Playlist } from '../types';

export default function Editor() {
  const { playlistId } = useParams();
  const [playlist, setPlaylist] = useState<Playlist | null>(() =>
    playlistId ? getPlaylist(playlistId) ?? null : null,
  );
  // "이 곡만 보내기"로 펼쳐진 단일 곡 공유 대상 (videoId). null이면 닫힘.
  const [shareSongId, setShareSongId] = useState<string | null>(null);

  const songs = useMemo<Song[]>(
    () => (playlist ? playlist.songIds.map((id) => getSong(id)).filter((s): s is Song => !!s) : []),
    [playlist],
  );

  const persist = (next: Playlist) => {
    // Keep the dead-no-more coverVideoId field in sync with the first song so
    // gallery cards can show a representative cover thumbnail (Fix 16).
    const synced: Playlist = { ...next, coverVideoId: next.songIds[0] };
    setPlaylist(synced);
    savePlaylist(synced);
  };

  if (!playlist) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center text-white">
        <p>플레이리스트를 찾을 수 없어요.</p>
        <Link to="/" className="mt-4 text-sm text-white/60 underline">홈으로</Link>
      </div>
    );
  }

  const handleAdd = (song: Song) => {
    persist({ ...playlist, songIds: [...playlist.songIds, song.id] });
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= playlist.songIds.length) return;
    const ids = [...playlist.songIds];
    [ids[index], ids[target]] = [ids[target], ids[index]];
    persist({ ...playlist, songIds: ids });
  };

  const removeAt = (index: number) => {
    const ids = playlist.songIds.filter((_, i) => i !== index);
    persist({ ...playlist, songIds: ids });
  };

  const shareBase = `${window.location.origin}${window.location.pathname}#/s/`;

  const { encoded } = buildSharePayload(
    { title: playlist.title, message: playlist.message, from: playlist.from },
    songs.map((s) => ({ id: s.id, title: s.title })),
  );
  const shareUrl = `${shareBase}${encoded}`;

  // 단일 곡 공유 URL: 같은 #/s/ 포맷, songs 배열에 곡 하나만.
  const shareSong = shareSongId ? songs.find((s) => s.id === shareSongId) ?? null : null;
  const singleShareUrl = shareSong
    ? `${shareBase}${
        buildSharePayload(
          { title: shareSong.title, message: playlist.message, from: playlist.from },
          [{ id: shareSong.id, title: shareSong.title }],
        ).encoded
      }`
    : '';

  return (
    <div className="min-h-screen px-6 py-10 text-white">
      <AppBackground />
      <header className="mb-6 flex items-center justify-between">
        <Link to="/" className="text-sm text-white/60 hover:text-white">← 갤러리</Link>
        <Link to={`/p/${playlist.id}`} className="text-sm text-white/60 hover:text-white">재생 →</Link>
      </header>

      <div className="mb-6 space-y-3">
        <label className="block text-xs text-white/50" htmlFor="pl-title">제목</label>
        <input
          id="pl-title"
          aria-label="제목"
          className="w-full rounded-xl bg-white/10 px-4 py-3 text-lg outline-none"
          value={playlist.title}
          onChange={(e) => persist({ ...playlist, title: e.target.value })}
        />
        <label className="block text-xs text-white/50" htmlFor="pl-message">메시지</label>
        <input
          id="pl-message"
          aria-label="메시지"
          placeholder="받는 사람에게 한 줄 남겨보세요"
          className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm outline-none placeholder:text-white/30"
          value={playlist.message ?? ''}
          onChange={(e) => persist({ ...playlist, message: e.target.value })}
        />
        <label className="block text-xs text-white/50" htmlFor="pl-from">보낸 사람 (선택)</label>
        <input
          id="pl-from"
          aria-label="보낸 사람"
          placeholder="이름을 적으면 'From.'으로 표시돼요"
          className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm outline-none placeholder:text-white/30"
          value={playlist.from ?? ''}
          onChange={(e) => persist({ ...playlist, from: e.target.value })}
        />
      </div>

      <PasteInput onAdd={handleAdd} />

      <ul className="mt-6 space-y-2">
        {songs.map((s, i) => (
          <li key={s.id} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="basis-full grow min-w-0 sm:basis-0">
                <SongCard
                  song={s}
                  onShare={() => setShareSongId((id) => (id === s.id ? null : s.id))}
                />
              </div>
              <button type="button" aria-label="위로" onClick={() => move(i, -1)} className="rounded-lg bg-white/10 px-2 py-1 text-xs">↑</button>
              <button type="button" aria-label="아래로" onClick={() => move(i, 1)} className="rounded-lg bg-white/10 px-2 py-1 text-xs">↓</button>
              <button type="button" aria-label="삭제" onClick={() => removeAt(i)} className="rounded-lg bg-red-500/20 px-2 py-1 text-xs text-red-200">✕</button>
            </div>
            {shareSongId === s.id ? (
              <div data-testid="single-share" className="rounded-2xl bg-white/5 p-4">
                <p className="mb-3 text-xs text-white/50">이 곡만 공유</p>
                <QrShare url={singleShareUrl} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="mt-10">
        <h2 className="mb-3 text-sm text-white/60">공유</h2>
        <QrShare url={shareUrl} />
      </div>
    </div>
  );
}
