import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlayGate from './PlayGate';
import type { SongColors } from '../types';

const colors: SongColors = { gradientFrom: '#101030', gradientTo: '#05050f', accent: '#7755ff' };

describe('PlayGate', () => {
  it('calls onPlay when the play button is tapped', async () => {
    const onPlay = vi.fn();
    render(<PlayGate cover="c.jpg" colors={colors} onPlay={onPlay} />);
    await userEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('renders the sender message when provided', () => {
    render(<PlayGate cover="c.jpg" colors={colors} message="너를 위한 플레이리스트" onPlay={() => {}} />);
    expect(screen.getByText('너를 위한 플레이리스트')).toBeInTheDocument();
  });

  it('does not render a message block when message is absent', () => {
    render(<PlayGate cover="c.jpg" colors={colors} onPlay={() => {}} />);
    expect(screen.queryByTestId('gate-message')).toBeNull();
  });

  it('renders exactly one play button', () => {
    render(<PlayGate cover="c.jpg" colors={colors} onPlay={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
