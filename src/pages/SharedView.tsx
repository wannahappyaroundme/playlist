import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { decodePlaylist } from '../lib/share';
import { getSong, createPlaylist, savePlaylist } from '../lib/storage';
import { useSongResolver } from '../hooks/useSongResolver';
import { usePlayback } from '../playback/PlaybackContext';
import { useLyricSync } from '../hooks/useLyricSync';
import GradientBg from '../components/GradientBg';
import LpDisc from '../components/LpDisc';
import LyricsView from '../components/LyricsView';
import Controls from '../components/Controls';
import PlayGate from '../components/PlayGate';
import type { Song, SharedPlaylist } from '../types';

export default function SharedView() {
  const { encoded } = useParams();
  const navigate = useNavigate();
  const playback = usePlayback();
  const { resolve } = useSongResolver();

  const shared = useMemo<SharedPlaylist | null>(
    () => (encoded ? decodePlaylist(encoded) : null),
    [encoded],
  );

  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!shared) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const resolved: Song[] = [];
      for (const entry of shared.songs) {
        const cached = getSong(entry.id);
        if (cached) { resolved.push(cached); continue; }
        try {
          const s = await resolve(entry.id);
          resolved.push(s);
        } catch {
          // skip unresolvable song (graceful)
        }
      }
      if (cancelled) return;
      setSongs(resolved);
      setLoading(false);
      if (resolved.length > 0) playback.playQueue(resolved, 0);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared]);

  const current = playback.current;
  const activeIndex = useLyricSync(
    playback.getCurrentTime,
    playback.isPlaying,
    current?.lyrics.synced ?? [],
    current?.lyrics.offsetMs ?? 0,
  );

  const saveToLibrary = () => {
    if (!shared) return;
    const p = createPlaylist(shared.title);
    const withSongs = { ...p, message: shared.message, songIds: songs.map((s) => s.id) };
    savePlaylist(withSongs);
    navigate(`/edit/${p.id}`);
  };

  if (!shared) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center text-white">
        <p>링크를 읽을 수 없어요. (잘못된 공유 링크)</p>
        <Link to="/" className="mt-4 text-sm text-white/60 underline">홈으로</Link>
      </div>
    );
  }

  const colors = current?.colors ?? { gradientFrom: '#0b1020', gradientTo: '#05070f', accent: '#6b7cff' };

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <GradientBg colors={colors} />

      {loading ? (
        <div className="relative z-10 flex min-h-screen items-center justify-center text-white/70">
          불러오는 중…
        </div>
      ) : !playback.started || !current ? (
        <PlayGate cover={current?.cover ?? ''} colors={colors} message={shared.message} onPlay={playback.start} />
      ) : (
        <div className="relative z-10 grid min-h-screen grid-rows-[1fr_auto] gap-6 px-6 py-8 lg:grid-cols-[46%_54%] lg:grid-rows-1">
          <div className="flex items-center justify-center">
            <LpDisc cover={current.cover} spinning={playback.isPlaying} accent={colors.accent} />
          </div>
          <div className="flex items-center justify-center">
            <LyricsView lyrics={current.lyrics} activeIndex={activeIndex} />
          </div>
          <div className="lg:col-span-2">
            <Controls
              isPlaying={playback.isPlaying}
              repeat={playback.repeat}
              progress={playback.progress}
              duration={playback.duration}
              onToggle={playback.togglePlay}
              onNext={playback.next}
              onPrev={playback.prev}
              onSeek={playback.seek}
              onCycleRepeat={playback.cycleRepeat}
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={saveToLibrary}
        className="fixed right-4 top-4 z-20 rounded-full bg-white/15 px-4 py-2 text-sm backdrop-blur hover:bg-white/25"
      >
        내 보관함에 저장
      </button>
    </div>
  );
}
