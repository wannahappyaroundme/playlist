import { useEffect, useRef } from 'react';

interface WakeLockSentinelLike {
  release(): Promise<void>;
}
type WakeLockNavigator = Navigator & {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
};

/**
 * active(재생 중)일 때 화면 꺼짐 방지(Screen Wake Lock)를 건다.
 * - 탭이 가려지면 OS가 lock을 자동 해제하므로, 다시 보일 때 재획득한다.
 * - 미지원(navigator.wakeLock 없음)/실패(배터리 절약·제스처 부족)는 조용히 무시한다.
 * 진짜 백그라운드 재생은 아니지만, 화면을 켜둔 채로는 계속 재생되게 해준다.
 */
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!active) return;
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) return;
    let cancelled = false;

    const acquire = async () => {
      try {
        const sentinel = await nav.wakeLock!.request('screen');
        if (cancelled) {
          Promise.resolve(sentinel.release()).catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
      } catch {
        // 사용자 제스처 부족/배터리 절약/미지원 등 — 치명적이지 않으므로 무시
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !cancelled) acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      Promise.resolve(sentinelRef.current?.release()).catch(() => {});
      sentinelRef.current = null;
    };
  }, [active]);
}
