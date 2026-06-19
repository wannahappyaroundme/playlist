import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Song, Playlist } from '../types';

const playQueueMock = vi.fn();
let playbackState: any;

vi.mock('../playback/PlaybackContext', () => ({
  usePlayback: () => playbackState,
}));
vi.mock('../hooks/useLyricSync', () => ({ useLyricSync: () => 0 }));
vi.mock('../components/GradientBg', () => ({ default: () => <div>GRADIENT</div> }));
vi.mock('../components/LpDisc', () => ({ default: () => <div>LPDISC</div> }));
vi.mock('../components/LyricsView', () => ({ default: () => <div>LYRICS</div> }));
vi.mock('../components/Controls', () => ({ default: () => <div>CONTROLS</div> }));
vi.mock('../components/PlayGate', () => ({
  default: ({ onPlay }: any) => <button onClick={onPlay}>PLAYGATE</button>,
}));

const getPlaylistMock = vi.fn();
const getSongMock = vi.fn();
vi.mock('../lib/storage', () => ({
  getPlaylist: (...a: any[]) => getPlaylistMock(...a),
  getSong: (...a: any[]) => getSongMock(...a),
}));

import Player from './Player';

const song = (id: string): Song => ({
  id, title: 't' + id, artist: 'a', durationSec: 100,
  cover: 'c', colors: { gradientFrom: '#111', gradientTo: '#000', accent: '#abc' },
  lyrics: { type: 'none', source: 'none', offsetMs: 0 }, resolvedAt: '2026-06-20',
});
const pl = (songIds: string[]): Playlist => ({
  id: 'pl1', title: 'L', songIds, createdAt: '2026-06-20',
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/p/:playlistId" element={<Player />} />
        <Route path="/p/:playlistId/:songId" element={<Player />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Player', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playbackState = {
      queue: [], currentIndex: 0, current: null,
      isPlaying: false, repeat: 'off', progress: 0, duration: 0, started: false,
      playQueue: playQueueMock, start: vi.fn(), togglePlay: vi.fn(), next: vi.fn(), prev: vi.fn(),
      seek: vi.fn(), cycleRepeat: vi.fn(), setRepeat: vi.fn(), getCurrentTime: () => 0,
    };
    getPlaylistMock.mockReturnValue(pl(['s0', 's1']));
    getSongMock.mockImplementation((id: string) => song(id));
  });

  it('loads playlist songs and calls playQueue on mount (start at index 0)', () => {
    renderAt('/p/pl1');
    expect(playQueueMock).toHaveBeenCalledTimes(1);
    const [songs, startIndex] = playQueueMock.mock.calls[0];
    expect(songs.map((s: Song) => s.id)).toEqual(['s0', 's1']);
    expect(startIndex ?? 0).toBe(0);
  });

  it('deep-link songId sets the start index', () => {
    renderAt('/p/pl1/s1');
    const [, startIndex] = playQueueMock.mock.calls[0];
    expect(startIndex).toBe(1);
  });

  it('shows PlayGate when not started', () => {
    renderAt('/p/pl1');
    expect(screen.getByText('PLAYGATE')).toBeInTheDocument();
  });

  it('shows player surface (Controls) once started', () => {
    playbackState.started = true;
    playbackState.current = song('s0');
    renderAt('/p/pl1');
    expect(screen.getByText('CONTROLS')).toBeInTheDocument();
  });
});
