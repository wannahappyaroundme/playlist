import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SongCard from './SongCard';
import type { Song } from '../types';

function makeSong(over: Partial<Song> = {}): Song {
  return {
    id: 'vid12345678',
    title: 'Test Title',
    artist: 'Test Artist',
    durationSec: 200,
    cover: 'https://i.ytimg.com/vi/vid12345678/maxresdefault.jpg',
    colors: { gradientFrom: '#101030', gradientTo: '#05050f', accent: '#7755ff' },
    lyrics: { type: 'synced', source: 'lrclib', offsetMs: 0, synced: [{ time: 0, text: 'x' }] },
    resolvedAt: '2026-06-20T00:00:00.000Z',
    ...over,
  };
}

describe('SongCard', () => {
  it('renders title, artist and cover', () => {
    render(<SongCard song={makeSong()} />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://i.ytimg.com/vi/vid12345678/maxresdefault.jpg'
    );
  });

  it('shows a synced-lyrics badge when lyrics are synced', () => {
    render(
      <SongCard
        song={makeSong({
          lyrics: { type: 'synced', source: 'lrclib', offsetMs: 0, synced: [{ time: 0, text: 'x' }] },
        })}
      />
    );
    expect(screen.getByTestId('lyric-badge')).toHaveTextContent(/싱크/);
  });

  it('shows a no-lyrics badge when lyrics are none', () => {
    render(<SongCard song={makeSong({ lyrics: { type: 'none', source: 'none', offsetMs: 0 } })} />);
    expect(screen.getByTestId('lyric-badge')).toHaveTextContent(/없음/);
  });

  it('applies active styling when active is true', () => {
    const { container, rerender } = render(<SongCard song={makeSong()} active={false} />);
    const root = () => container.querySelector('[data-testid="song-card"]') as HTMLElement;
    expect(root()).toHaveAttribute('data-active', 'false');
    rerender(<SongCard song={makeSong()} active />);
    expect(root()).toHaveAttribute('data-active', 'true');
    expect(root().className).toContain('ring-2');
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<SongCard song={makeSong()} onClick={onClick} />);
    await userEvent.click(screen.getByTestId('song-card'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
