import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPlaylist, savePlaylist, getSong, StorageWriteError } from '../lib/storage';
import { buildSharePayload } from '../lib/share';
import { useSongResolver } from '../hooks/useSongResolver';
import PasteInput from '../components/PasteInput';
import SongCard from '../components/SongCard';
import QrShare from '../components/QrShare';
import AppBackground from '../components/AppBackground';
import type { Song, Playlist } from '../types';

// 카드 색상 프리셋(직접 고르기). 갤러리에서 cardGradient로 같은 색상의 그라데이션이 된다.
const CARD_COLORS = ['#a855f7', '#6366f1', '#3b82f6', '#14b8a6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];

export default function Editor() {
  const { playlistId } = useParams();
  const [playlist, setPlaylist] = useState<Playlist | null>(() =>
    playlistId ? getPlaylist(playlistId) ?? null : null,
  );
  // "이 곡만 보내기"로 펼쳐진 단일 곡 공유 대상 (videoId). null이면 닫힘.
  const [shareSongId, setShareSongId] = useState<string | null>(null);
  const { reResolve } = useSongResolver();
  // reResolve가 풀(saveSong)을 덮어쓴 뒤 songs 메모를 다시 계산시키는 트리거.
  const [poolVersion, setPoolVersion] = useState(0);
  // 현재 '다시 찾기' 진행 중인 곡 id(버튼 비활성/aria-busy용).
  const [reResolvingId, setReResolvingId] = useState<string | null>(null);

  const songs = useMemo<Song[]>(
    () => (playlist ? playlist.songIds.map((id) => getSong(id)).filter((s): s is Song => !!s) : []),
    // poolVersion이 바뀌면 풀에서 곡을 다시 읽어 갱신된 제목/가사/색을 반영한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playlist, poolVersion],
  );

  const persist = (next: Playlist) => {
    // Keep the dead-no-more coverVideoId field in sync with the first song so
    // gallery cards can show a representative cover thumbnail (Fix 16).
    const synced: Playlist = { ...next, coverVideoId: next.songIds[0] };
    // 먼저 저장하고, 성공했을 때만 React 상태를 갱신한다 — quota 초과면 저장 안 된 값을
    // 화면에 반영하지 않고(롤백) 안내만 한다.
    try {
      savePlaylist(synced);
    } catch (err) {
      if (err instanceof StorageWriteError) {
        window.alert('저장 공간이 가득 찼어요 — 갤러리에서 내보내기로 백업 후 정리해 주세요');
        return; // setPlaylist 호출 안 함(미저장 값이 화면에 남지 않게)
      }
      throw err;
    }
    setPlaylist(synced);
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
    // 같은 링크/저장된 곡을 다시 담으면 songIds=[X,X]가 되어 React key 중복 + 같은 곡 2번 재생.
    if (playlist.songIds.includes(song.id)) {
      window.alert('이미 담긴 곡이에요');
      return;
    }
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

  // 가사/메타가 안 잡힌 곡을 캐시 무시하고 강제로 다시 찾아 풀을 덮어쓴 뒤 목록을 갱신한다.
  const handleReResolve = async (songId: string) => {
    if (reResolvingId) return; // 동시 다중 실행 방지
    setReResolvingId(songId);
    try {
      await reResolve(songId);
      setPoolVersion((v) => v + 1); // 갱신된 제목/가사/색을 다시 읽게 한다
    } catch {
      window.alert('다시 찾기에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setReResolvingId(null);
    }
  };

  const shareBase = `${window.location.origin}${window.location.pathname}#/s/`;

  const { encoded } = buildSharePayload(
    { title: playlist.title, message: playlist.message, from: playlist.from, color: playlist.color },
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
        <p className="text-xs text-white/40">
          이 링크는 받은 사람 누구나 열 수 있어요 — 비밀 메시지는 넣지 마세요.
        </p>
        <label className="block text-xs text-white/50" htmlFor="pl-from">보낸 사람 (선택)</label>
        <input
          id="pl-from"
          aria-label="보낸 사람"
          placeholder="이름을 적으면 'From.'으로 표시돼요"
          className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm outline-none placeholder:text-white/30"
          value={playlist.from ?? ''}
          onChange={(e) => persist({ ...playlist, from: e.target.value })}
        />
        <label className="block text-xs text-white/50">카드 색상</label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => persist({ ...playlist, color: undefined })}
            className={
              'rounded-full px-3 py-1.5 text-xs transition ' +
              (!playlist.color
                ? 'bg-white/25 text-white ring-1 ring-white/40'
                : 'bg-white/10 text-white/70 hover:bg-white/20')
            }
          >
            자동(곡 색)
          </button>
          {CARD_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`카드 색상 ${c}`}
              onClick={() => persist({ ...playlist, color: c })}
              style={{ backgroundColor: c }}
              className={
                'h-7 w-7 rounded-full transition hover:scale-110 ' +
                (playlist.color === c
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-black/40'
                  : 'ring-1 ring-white/20')
              }
            />
          ))}
          <label className="ml-1 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs text-white/70 hover:bg-white/20">
            직접
            <input
              type="color"
              aria-label="카드 색상 직접 선택"
              value={playlist.color ?? '#a855f7'}
              onChange={(e) => persist({ ...playlist, color: e.target.value })}
              className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
            />
          </label>
        </div>
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
              <button
                type="button"
                aria-label="가사/메타 다시 찾기"
                aria-busy={reResolvingId === s.id}
                disabled={reResolvingId !== null}
                onClick={() => handleReResolve(s.id)}
                className="rounded-lg bg-white/10 px-2 py-1 text-xs disabled:opacity-50"
              >
                {reResolvingId === s.id ? '찾는 중…' : '다시 찾기'}
              </button>
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
        <p className="mb-3 text-xs text-white/40">
          이 링크는 받은 사람 누구나 열 수 있어요 — 비밀 메시지는 넣지 마세요.
        </p>
        <QrShare url={shareUrl} />
      </div>
    </div>
  );
}
