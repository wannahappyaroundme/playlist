import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPlaylist, savePlaylist, getSong } from '../lib/storage';
import { encodePlaylist } from '../lib/share';
import PasteInput from '../components/PasteInput';
import SongCard from '../components/SongCard';
import QrShare from '../components/QrShare';
import type { Song, Playlist, SharedPlaylist } from '../types';

export default function Editor() {
  const { playlistId } = useParams();
  const [playlist, setPlaylist] = useState<Playlist | null>(() =>
    playlistId ? getPlaylist(playlistId) ?? null : null,
  );

  const songs = useMemo<Song[]>(
    () => (playlist ? playlist.songIds.map((id) => getSong(id)).filter((s): s is Song => !!s) : []),
    [playlist],
  );

  const persist = (next: Playlist) => {
    setPlaylist(next);
    savePlaylist(next);
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

  const shareUrl = (() => {
    const payload: SharedPlaylist = {
      title: playlist.title,
      message: playlist.message,
      songs: songs.map((s) => ({ id: s.id, title: s.title })),
    };
    const encoded = encodePlaylist(payload);
    return `${window.location.origin}${window.location.pathname}#/s/${encoded}`;
  })();

  return (
    <div className="min-h-screen px-6 py-10 text-white">
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
          className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm outline-none"
          value={playlist.message ?? ''}
          onChange={(e) => persist({ ...playlist, message: e.target.value })}
        />
      </div>

      <PasteInput onAdd={handleAdd} />

      <ul className="mt-6 space-y-2">
        {songs.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2">
            <div className="flex-1">
              <SongCard song={s} />
            </div>
            <button type="button" aria-label="위로" onClick={() => move(i, -1)} className="rounded-lg bg-white/10 px-2 py-1 text-xs">↑</button>
            <button type="button" aria-label="아래로" onClick={() => move(i, 1)} className="rounded-lg bg-white/10 px-2 py-1 text-xs">↓</button>
            <button type="button" aria-label="삭제" onClick={() => removeAt(i)} className="rounded-lg bg-red-500/20 px-2 py-1 text-xs text-red-200">✕</button>
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
