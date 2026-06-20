import { useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPlaylist, getSong } from '../lib/storage';
import { usePlayback } from '../playback/PlaybackContext';
import { useLyricSync } from '../hooks/useLyricSync';
import GradientBg from '../components/GradientBg';
import LpDisc from '../components/LpDisc';
import LyricsView from '../components/LyricsView';
import Controls from '../components/Controls';
import PlayGate from '../components/PlayGate';
import SkipToast from '../components/SkipToast';
import type { Song } from '../types';

export default function Player() {
  const { playlistId, songId } = useParams();
  const playback = usePlayback();

  const { songs, message } = useMemo<{ songs: Song[]; message?: string }>(() => {
    if (!playlistId) return { songs: [] };
    const pl = getPlaylist(playlistId);
    if (!pl) return { songs: [] };
    return {
      songs: pl.songIds.map((id) => getSong(id)).filter((s): s is Song => !!s),
      message: pl.message,
    };
  }, [playlistId]);

  const startIndex = useMemo(() => {
    if (!songId) return 0;
    const idx = songs.findIndex((s) => s.id === songId);
    return idx >= 0 ? idx : 0;
  }, [songs, songId]);

  useEffect(() => {
    if (songs.length > 0) playback.playQueue(songs, startIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs, startIndex]);

  const current = playback.current;
  const activeIndex = useLyricSync(
    playback.getCurrentTime,
    playback.isPlaying,
    current?.lyrics.synced ?? [],
    current?.lyrics.offsetMs ?? 0,
  );

  if (songs.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center text-white">
        <p>플레이리스트를 찾을 수 없어요.</p>
        <Link to="/" className="mt-4 text-sm text-white/60 underline">홈으로</Link>
      </div>
    );
  }

  const colors = current?.colors ?? { gradientFrom: '#0b1020', gradientTo: '#05070f', accent: '#6b7cff' };

  return (
    <div className="relative h-[100dvh] overflow-hidden text-white">
      <GradientBg colors={colors} />
      <SkipToast error={playback.lastError} />

      {!playback.started || !current ? (
        <PlayGate
          cover={current?.cover ?? ''}
          colors={colors}
          message={message}
          onPlay={playback.start}
        />
      ) : (
        <div className="relative z-10 grid h-[100dvh] grid-rows-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 px-6 py-6 lg:grid-cols-[46%_54%] lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-6 lg:px-10 lg:py-8">
          <div className="flex min-h-0 items-center justify-center">
            <LpDisc cover={current.cover} spinning={playback.isPlaying} accent={colors.accent} />
          </div>
          <div className="flex min-h-0 items-stretch justify-center">
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
    </div>
  );
}
