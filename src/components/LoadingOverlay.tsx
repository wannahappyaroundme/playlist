import { useEffect, useState } from 'react';

interface LoadingOverlayProps {
  show: boolean;
  /** 순환 표시할 단계 문구들 */
  messages?: string[];
}

const DEFAULT_MESSAGES = [
  '곡 정보를 가져오는 중이에요…',
  '가사를 찾는 중이에요…',
  '앨범 색을 입히는 중이에요…',
  '거의 다 됐어요…',
];

const ROTATE_MS = 1600;

/**
 * 전체 화면 위에 뜨는 로딩 오버레이. 회전 스피너 + 단계 문구가 순환한다.
 * 곡 추가 등 비동기 작업이 끝날 때까지 무엇을 하는지 사용자에게 보여준다.
 */
export default function LoadingOverlay({ show, messages = DEFAULT_MESSAGES }: LoadingOverlayProps) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!show) {
      setIdx(0);
      return;
    }
    const id = window.setInterval(() => setIdx((i) => (i + 1) % messages.length), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [show, messages.length]);

  if (!show) return null;

  return (
    <div
      data-testid="loading-overlay"
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black/70 backdrop-blur-sm"
    >
      <div className="h-12 w-12 rounded-full border-4 border-white/20 border-t-white motion-safe:animate-spin motion-reduce:animate-pulse" />
      <p className="text-sm text-white/90">{messages[idx]}</p>
    </div>
  );
}
