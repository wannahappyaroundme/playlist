import { useCallback, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPlaylist, getSong } from '../lib/storage';
import { usePlayback } from '../playback/PlaybackContext';
import { useLyricSync } from '../hooks/useLyricSync';
import { hasDisplayableLyrics } from '../lib/lyrics';
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

  const { songs, message, from } = useMemo<{ songs: Song[]; message?: string; from?: string }>(() => {
    if (!playlistId) return { songs: [] };
    const pl = getPlaylist(playlistId);
    if (!pl) return { songs: [] };
    return {
      songs: pl.songIds.map((id) => getSong(id)).filter((s): s is Song => !!s),
      message: pl.message,
      from: pl.from,
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
  const { getDuration } = playback;
  const expectedDur = current?.durationSec ?? 0;
  // 광고/로딩 감지: 라이브 재생 길이가 곡 길이와 크게 다르면 아직 '진짜 곡'이 아님(보통 선광고).
  const contentReady = useCallback(() => {
    if (expectedDur <= 0) return true; // 길이 정보 없으면 게이트하지 않음(과차단 방지)
    const live = getDuration();
    if (live <= 0) return true; // 버퍼링/메타 미로딩(0)은 게이트하지 않음 — 흰 줄 깜빡임 방지
    return Math.abs(live - expectedDur) <= Math.max(6, expectedDur * 0.05);
  }, [getDuration, expectedDur]);
  const activeIndex = useLyricSync(
    playback.getCurrentTime,
    playback.isPlaying,
    current?.lyrics.synced ?? [],
    current?.lyrics.offsetMs ?? 0,
    contentReady,
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

  // 광고/로딩 동안엔 라이브 길이가 곡 길이와 달라 가사가 멈춰 있다 — 사용자에게 이유를 알려준다.
  const adOrLoading =
    playback.started &&
    playback.isPlaying &&
    expectedDur > 0 &&
    Math.abs(playback.duration - expectedDur) > Math.max(6, expectedDur * 0.05);

  // 표시할 가사가 없으면 가사 칸을 없애고 LP만 가운데 띄운다.
  const showLyrics = !!current && hasDisplayableLyrics(current.lyrics);
  // Controls는 두 레이아웃에서 동일하게 쓰이므로 한 번만 만들어 재사용한다.
  const controls = (
    <Controls
      isPlaying={playback.isPlaying}
      repeat={playback.repeat}
      shuffle={playback.shuffle}
      progress={playback.progress}
      duration={playback.duration}
      onToggle={playback.togglePlay}
      onNext={playback.next}
      onPrev={playback.prev}
      onSeek={playback.seek}
      onCycleRepeat={playback.cycleRepeat}
      onToggleShuffle={playback.toggleShuffle}
    />
  );

  return (
    <div className="relative h-[100dvh] overflow-hidden text-white">
      <GradientBg colors={colors} />
      <SkipToast error={playback.lastError} />
      {adOrLoading ? (
        <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-black/55 px-4 py-1.5 text-xs text-white/80 backdrop-blur">
          잠시 후 가사가 시작돼요…
        </div>
      ) : null}

      {!playback.started || !current ? (
        <PlayGate
          cover={current?.cover ?? ''}
          colors={colors}
          message={message}
          from={from}
          onPlay={playback.start}
        />
      ) : showLyrics ? (
        <div className="relative z-10 grid h-[100dvh] grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,0.9fr)_minmax(0,1.1fr)_auto] gap-4 px-6 py-6 lg:grid-cols-[46%_54%] lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-6 lg:px-10 lg:py-8">
          <div className="flex min-h-0 items-center justify-center">
            <LpDisc cover={current.cover} spinning={playback.isPlaying} accent={colors.accent} />
          </div>
          <div className="flex min-h-0 items-stretch justify-center">
            <div className="h-full w-full lg:max-w-2xl">
              <LyricsView lyrics={current.lyrics} activeIndex={activeIndex} accent={colors.accent} />
            </div>
          </div>
          <div className="lg:col-span-2">{controls}</div>
        </div>
      ) : (
        // 가사 없음: '가사 없음' 문구 대신 앨범+디스크만 화면 정중앙에 크게 띄운다.
        <div className="relative z-10 grid h-[100dvh] grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] gap-4 px-6 py-6 lg:px-10 lg:py-8">
          <div className="flex min-h-0 items-center justify-center">
            <LpDisc cover={current.cover} spinning={playback.isPlaying} accent={colors.accent} big />
          </div>
          <div>{controls}</div>
        </div>
      )}
    </div>
  );
}
