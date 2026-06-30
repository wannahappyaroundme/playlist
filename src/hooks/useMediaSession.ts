import { useEffect } from 'react';
import type { Song } from '../types';

export interface MediaSessionHandlers {
  onPlay(): void;
  onPause(): void;
  onNext(): void;
  onPrev(): void;
}

/**
 * 잠금화면/알림의 미디어 컨트롤(MediaSession)에 현재 곡 정보와 재생/일시정지/이전/다음
 * 핸들러를 연결한다. 주로 안드로이드에서 노출되며, 유튜브 임베드가 자기 정보로 덮어쓸 수
 * 있어 효과는 환경마다 다를 수 있다. 미지원이면 전부 no-op(안전).
 */
export function useMediaSession(
  current: Song | null,
  isPlaying: boolean,
  handlers: MediaSessionHandlers,
): void {
  const { onPlay, onPause, onNext, onPrev } = handlers;

  // 곡이 바뀌면 메타데이터(제목/아티스트/앨범아트) 갱신
  useEffect(() => {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined' || !current) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artist,
        artwork: current.cover ? [{ src: current.cover, sizes: '480x360', type: 'image/jpeg' }] : [],
      });
    } catch {
      // ignore
    }
  }, [current]);

  // 재생/일시정지 상태 반영
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch {
      // ignore
    }
  }, [isPlaying]);

  // 액션 핸들러 등록(언마운트 시 해제)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const set = (action: MediaSessionAction, handler: (() => void) | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // 일부 액션 미지원 — 무시
      }
    };
    set('play', onPlay);
    set('pause', onPause);
    set('previoustrack', onPrev);
    set('nexttrack', onNext);
    return () => {
      set('play', null);
      set('pause', null);
      set('previoustrack', null);
      set('nexttrack', null);
    };
  }, [onPlay, onPause, onNext, onPrev]);
}
