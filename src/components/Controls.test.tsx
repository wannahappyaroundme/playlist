import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Controls, { formatTime } from './Controls';

describe('formatTime', () => {
  it('formats seconds as m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(600)).toBe('10:00');
  });
  it('clamps NaN/negative to 0:00', () => {
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(-3)).toBe('0:00');
  });
});

describe('Controls', () => {
  const base = {
    isPlaying: false,
    repeat: 'off' as const,
    progress: 30,
    duration: 200,
    onToggle: vi.fn(),
    onNext: vi.fn(),
    onPrev: vi.fn(),
    onSeek: vi.fn(),
    onCycleRepeat: vi.fn(),
  };

  it('shows a Play label when paused and Pause label when playing', () => {
    const { rerender } = render(<Controls {...base} />);
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    rerender(<Controls {...base} isPlaying />);
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
  });

  it('wires toggle, next, prev callbacks', async () => {
    const onToggle = vi.fn();
    const onNext = vi.fn();
    const onPrev = vi.fn();
    render(<Controls {...base} onToggle={onToggle} onNext={onNext} onPrev={onPrev} />);
    await userEvent.click(screen.getByRole('button', { name: /play/i }));
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    await userEvent.click(screen.getByRole('button', { name: /prev/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('reflects repeat mode via data-mode and aria-pressed', () => {
    const { rerender } = render(<Controls {...base} repeat="off" />);
    const btn = () => screen.getByTestId('repeat-btn');
    expect(btn()).toHaveAttribute('data-mode', 'off');
    expect(btn()).toHaveAttribute('aria-pressed', 'false');
    rerender(<Controls {...base} repeat="all" />);
    expect(btn()).toHaveAttribute('data-mode', 'all');
    expect(btn()).toHaveAttribute('aria-pressed', 'true');
    rerender(<Controls {...base} repeat="one" />);
    expect(btn()).toHaveAttribute('data-mode', 'one');
  });

  it('calls onCycleRepeat when the repeat button is clicked', async () => {
    const onCycleRepeat = vi.fn();
    render(<Controls {...base} onCycleRepeat={onCycleRepeat} />);
    await userEvent.click(screen.getByTestId('repeat-btn'));
    expect(onCycleRepeat).toHaveBeenCalledTimes(1);
  });

  it('calls onSeek with the new value when the progress slider changes', () => {
    const onSeek = vi.fn();
    render(<Controls {...base} onSeek={onSeek} />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '120' } });
    expect(onSeek).toHaveBeenCalledWith(120);
  });

  it('renders current and total time labels', () => {
    render(<Controls {...base} progress={65} duration={185} />);
    expect(screen.getByText('1:05')).toBeInTheDocument();
    expect(screen.getByText('3:05')).toBeInTheDocument();
  });
});
