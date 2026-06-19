import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Song, Playlist, SharedPlaylist } from '../types';

const song = (id: string): Song => ({
  id, title: 's' + id, artist: 'a', durationSec: 100, cover: 'c',
  colors: { gradientFrom: '#111', gradientTo: '#000', accent: '#abc' },
  lyrics: { type: 'none', source: 'none', offsetMs: 0 }, resolvedAt: '2026-06-20',
});
const pl: Playlist = { id: 'pl1', title: 'L', songIds: ['s0'], createdAt: '2026-06-20' };
const shared: SharedPlaylist = { title: 'G', songs: [{ id: 's0' }] };

vi.mock('../hooks/usePlaylists', () => ({
  usePlaylists: () => ({ playlists: [pl], refresh: vi.fn(), create: vi.fn(() => pl), remove: vi.fn() }),
}));
vi.mock('../lib/storage', () => ({
  getPlaylist: () => pl, getSong: (id: string) => song(id),
  savePlaylist: vi.fn(), createPlaylist: () => pl,
}));
vi.mock('../lib/share', () => ({ encodePlaylist: () => 'ENC', decodePlaylist: () => shared }));
vi.mock('../hooks/useSongResolver', () => ({
  useSongResolver: () => ({ resolve: async (id: string) => song(id), resolving: false }),
}));
vi.mock('../hooks/useLyricSync', () => ({ useLyricSync: () => 0 }));
const playback = {
  queue: [song('s0')], currentIndex: 0, current: song('s0'),
  isPlaying: false, repeat: 'off' as const, progress: 0, duration: 100, started: false,
  playQueue: vi.fn(), start: vi.fn(), togglePlay: vi.fn(), next: vi.fn(), prev: vi.fn(),
  seek: vi.fn(), cycleRepeat: vi.fn(), setRepeat: vi.fn(), getCurrentTime: () => 0,
};
vi.mock('../playback/PlaybackContext', () => ({ usePlayback: () => playback }));
vi.mock('../components/GradientBg', () => ({ default: () => <div /> }));
vi.mock('../components/LpDisc', () => ({ default: () => <div /> }));
vi.mock('../components/LyricsView', () => ({ default: () => <div /> }));
vi.mock('../components/Controls', () => ({ default: () => <div /> }));
vi.mock('../components/PlayGate', () => ({ default: () => <div /> }));
vi.mock('../components/SongCard', () => ({ default: () => <div /> }));
vi.mock('../components/PasteInput', () => ({ default: () => <div /> }));
vi.mock('../components/QrShare', () => ({ default: () => <div /> }));

import Gallery from './Gallery';
import Player from './Player';
import Editor from './Editor';
import SharedView from './SharedView';

describe('pages smoke', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('Gallery mounts without crashing', () => {
    expect(() => render(<MemoryRouter><Gallery /></MemoryRouter>)).not.toThrow();
  });
  it('Player mounts without crashing', () => {
    expect(() => render(
      <MemoryRouter initialEntries={['/p/pl1']}>
        <Routes><Route path="/p/:playlistId" element={<Player />} /></Routes>
      </MemoryRouter>,
    )).not.toThrow();
  });
  it('Editor mounts without crashing', () => {
    expect(() => render(
      <MemoryRouter initialEntries={['/edit/pl1']}>
        <Routes><Route path="/edit/:playlistId" element={<Editor />} /></Routes>
      </MemoryRouter>,
    )).not.toThrow();
  });
  it('SharedView mounts without crashing', () => {
    expect(() => render(
      <MemoryRouter initialEntries={['/s/ENC']}>
        <Routes><Route path="/s/:encoded" element={<SharedView />} /></Routes>
      </MemoryRouter>,
    )).not.toThrow();
  });
});
