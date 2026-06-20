import { useEffect, useState } from 'react';
import type { PlaybackError } from '../playback/PlaybackContext';

interface SkipToastProps {
  /** 마지막 '재생 불가' 스킵 정보. 갱신될 때마다 ~2초간 토스트를 띄운다. */
  error: PlaybackError | null;
  /** 자동 사라짐 시간(ms). 기본 2000. */
  durationMs?: number;
}

/**
 * '○○ 곡은 재생할 수 없어 건너뛰었어요' 토스트. error.at 이 바뀔 때마다 다시 나타나고
 * durationMs 후 스스로 사라진다(jsdom-safe: window.setTimeout 사용).
 */
export default function SkipToast({ error, durationMs = 2000 }: SkipToastProps) {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (!error) return;
    setTitle(error.title);
    setVisible(true);
    const id = window.setTimeout(() => setVisible(false), durationMs);
    return () => window.clearTimeout(id);
    // error.at changes on every fresh error-skip → re-trigger
  }, [error?.at, error, durationMs]);

  if (!visible) return null;

  return (
    <div
      data-testid="skip-toast"
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-6 pointer-events-none"
    >
      <div className="max-w-[90%] truncate rounded-full bg-black/70 px-4 py-2 text-sm text-white/90 shadow-lg ring-1 ring-white/10 backdrop-blur">
        {title} 곡은 재생할 수 없어 건너뛰었어요
      </div>
    </div>
  );
}
