import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import SkipToast from './SkipToast';

describe('SkipToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when there is no error', () => {
    render(<SkipToast error={null} />);
    expect(screen.queryByTestId('skip-toast')).toBeNull();
  });

  it('shows the skipped song title in the Korean copy when an error arrives', () => {
    render(<SkipToast error={{ title: '없는 노래', at: 1 }} />);
    const toast = screen.getByTestId('skip-toast');
    expect(toast).toHaveTextContent('없는 노래 곡은 재생할 수 없어 건너뛰었어요');
  });

  it('auto-dismisses after the duration', () => {
    render(<SkipToast error={{ title: 'X', at: 1 }} durationMs={2000} />);
    expect(screen.getByTestId('skip-toast')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByTestId('skip-toast')).toBeNull();
  });

  it('re-appears when a new error (different at) arrives after dismissal', () => {
    const { rerender } = render(<SkipToast error={{ title: 'A', at: 1 }} durationMs={2000} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByTestId('skip-toast')).toBeNull();
    rerender(<SkipToast error={{ title: 'B', at: 2 }} durationMs={2000} />);
    expect(screen.getByTestId('skip-toast')).toHaveTextContent('B 곡은 재생할 수 없어 건너뛰었어요');
  });
});
