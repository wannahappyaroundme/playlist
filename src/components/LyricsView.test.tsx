import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LyricsView from './LyricsView';
import type { SongLyrics } from '../types';

const synced: SongLyrics = {
  type: 'synced',
  source: 'lrclib',
  offsetMs: 0,
  synced: [
    { time: 0, text: 'first line' },
    { time: 5, text: 'second line' },
    { time: 10, text: 'third line' },
  ],
};

describe('LyricsView', () => {
  it('marks the active line and applies the highlight (white) class', () => {
    render(<LyricsView lyrics={synced} activeIndex={1} />);
    const active = screen.getByText('second line');
    expect(active).toHaveAttribute('data-active', 'true');
    expect(active.className).toContain('text-white');
  });

  it('non-active lines are not marked active', () => {
    render(<LyricsView lyrics={synced} activeIndex={1} />);
    expect(screen.getByText('first line')).toHaveAttribute('data-active', 'false');
    expect(screen.getByText('third line')).toHaveAttribute('data-active', 'false');
  });

  it('translates the container up proportional to activeIndex', () => {
    const { container, rerender } = render(<LyricsView lyrics={synced} activeIndex={0} />);
    const track = () =>
      (container.querySelector('[data-testid="lyrics-track"]') as HTMLElement).style.transform;
    const t0 = track();
    rerender(<LyricsView lyrics={synced} activeIndex={2} />);
    const t2 = track();
    expect(t0).not.toBe(t2);
    expect(t2).toMatch(/translateY/);
  });

  it('renders a plain-lyrics fallback with an "out of sync" badge', () => {
    const plain: SongLyrics = { type: 'plain', source: 'lrclib', offsetMs: 0, plain: 'la la la' };
    render(<LyricsView lyrics={plain} activeIndex={-1} />);
    expect(screen.getByText('la la la')).toBeInTheDocument();
    expect(screen.getByTestId('lyrics-badge')).toBeInTheDocument();
  });

  it('renders a "not found" message when there are no lyrics', () => {
    const none: SongLyrics = { type: 'none', source: 'none', offsetMs: 0 };
    render(<LyricsView lyrics={none} activeIndex={-1} />);
    expect(screen.getByTestId('lyrics-none')).toBeInTheDocument();
  });
});
