import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import type { Song, SharedPlaylist, Playlist } from '../types';

const decodeMock = vi.fn();
vi.mock('../lib/share', () => ({ decodePlaylist: (...a: any[]) => decodeMock(...a) }));

const getSongMock = vi.fn();
const createPlaylistMock = vi.fn();
const savePlaylistMock = vi.fn();
vi.mock('../lib/storage', () => ({
  getSong: (...a: any[]) => getSongMock(...a),
  createPlaylist: (...a: any[]) => createPlaylistMock(...a),
  savePlaylist: (...a: any[]) => savePlaylistMock(...a),
}));

const resolveMock = vi.fn();
vi.mock('../hooks/useSongResolver', () => ({
  useSongResolver: () => ({ resolve: resolveMock, resolving: false }),
}));

const playQueueMock = vi.fn();
const appendToQueueMock = vi.fn();
let playbackState: any;
vi.mock('../playback/PlaybackContext', () => ({ usePlayback: () => playbackState }));
vi.mock('../hooks/useLyricSync', () => ({ useLyricSync: () => 0 }));
vi.mock('../components/GradientBg', () => ({ default: () => <div>GRADIENT</div> }));
vi.mock('../components/LpDisc', () => ({ default: () => <div>LPDISC</div> }));
vi.mock('../components/LyricsView', () => ({ default: () => <div>LYRICS</div> }));
vi.mock('../components/Controls', () => ({ default: () => <div>CONTROLS</div> }));
vi.mock('../components/PlayGate', () => ({ default: ({ onPlay }: any) => <button onClick={onPlay}>PLAYGATE</button> }));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

import SharedView from './SharedView';

const song = (id: string): Song => ({
  id, title: 's' + id, artist: 'a', durationSec: 100,
  cover: 'c', colors: { gradientFrom: '#111', gradientTo: '#000', accent: '#abc' },
  lyrics: { type: 'none', source: 'none', offsetMs: 0 }, resolvedAt: '2026-06-20',
});

function renderAt(encoded: string) {
  return render(
    <MemoryRouter initialEntries={[`/s/${encoded}`]}>
      <Routes><Route path="/s/:encoded" element={<SharedView />} /></Routes>
    </MemoryRouter>,
  );
}

describe('SharedView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playbackState = {
      queue: [], currentIndex: 0, current: null,
      isPlaying: false, repeat: 'off', progress: 0, duration: 0, started: false, lastError: null,
      playQueue: playQueueMock, appendToQueue: appendToQueueMock,
      start: vi.fn(), togglePlay: vi.fn(), next: vi.fn(), prev: vi.fn(),
      seek: vi.fn(), cycleRepeat: vi.fn(), setRepeat: vi.fn(), getCurrentTime: () => 0,
    };
  });

  it('shows error message when decode fails', () => {
    decodeMock.mockReturnValue(null);
    renderAt('BAD');
    expect(screen.getByText(/링크를 읽을 수 없어요|잘못된/)).toBeInTheDocument();
  });

  it('plays the first song immediately, then appends the rest in order (progressive)', async () => {
    const shared: SharedPlaylist = { title: 'Gift', songs: [{ id: 's0' }, { id: 's1' }] };
    decodeMock.mockReturnValue(shared);
    getSongMock.mockImplementation((id: string) => (id === 's0' ? song('s0') : undefined));
    resolveMock.mockImplementation(async (id: string) => song(id));
    renderAt('GOOD');
    // first song plays right away (no waiting for the whole list)
    await waitFor(() => expect(playQueueMock).toHaveBeenCalled());
    const [firstSongs] = playQueueMock.mock.calls[0];
    expect(firstSongs.map((s: Song) => s.id)).toEqual(['s0']);
    // remaining songs are appended (resolved in background)
    await waitFor(() => expect(appendToQueueMock).toHaveBeenCalled());
    const appended = appendToQueueMock.mock.calls.flatMap((c) => c[0].map((s: Song) => s.id));
    expect(appended).toEqual(['s1']);
    expect(resolveMock).toHaveBeenCalledWith('s1'); // s0 came from cache
  });

  it('skips an unresolvable middle song but appends later ones in order', async () => {
    const shared: SharedPlaylist = {
      title: 'Gift', songs: [{ id: 's0' }, { id: 'bad' }, { id: 's2' }],
    };
    decodeMock.mockReturnValue(shared);
    getSongMock.mockReturnValue(undefined);
    resolveMock.mockImplementation(async (id: string) => {
      if (id === 'bad') throw new Error('unplayable');
      return song(id);
    });
    renderAt('GOOD');
    await waitFor(() => expect(playQueueMock).toHaveBeenCalled());
    expect(playQueueMock.mock.calls[0][0].map((s: Song) => s.id)).toEqual(['s0']);
    // 'bad' is skipped; only s2 gets appended, after s0
    await waitFor(() => {
      const appended = appendToQueueMock.mock.calls.flatMap((c) => c[0].map((s: Song) => s.id));
      expect(appended).toEqual(['s2']);
    });
  });

  it('"내 보관함에 저장" creates a playlist with the song ids and navigates', async () => {
    const shared: SharedPlaylist = { title: 'Gift', songs: [{ id: 's0' }] };
    decodeMock.mockReturnValue(shared);
    getSongMock.mockImplementation((id: string) => song(id));
    resolveMock.mockImplementation(async (id: string) => song(id));
    const created: Playlist = { id: 'newpl', title: 'Gift', songIds: [], createdAt: '2026-06-20' };
    createPlaylistMock.mockReturnValue(created);
    renderAt('GOOD');
    await waitFor(() => expect(playQueueMock).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /내 보관함에 저장/ }));
    expect(createPlaylistMock).toHaveBeenCalledWith('Gift');
    const calls = savePlaylistMock.mock.calls;
    const saved = calls[calls.length - 1][0] as Playlist;
    expect(saved.songIds).toEqual(['s0']);
    expect(navigateMock).toHaveBeenCalledWith('/edit/newpl');
  });
});
