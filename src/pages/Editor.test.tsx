import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import type { Song, Playlist } from '../types';

const savePlaylistMock = vi.fn();
const getPlaylistMock = vi.fn();
const getSongMock = vi.fn();
const { StorageWriteErrorMock } = vi.hoisted(() => ({ StorageWriteErrorMock: class extends Error {} }));
vi.mock('../lib/storage', () => ({
  getPlaylist: (...a: any[]) => getPlaylistMock(...a),
  savePlaylist: (...a: any[]) => savePlaylistMock(...a),
  getSong: (...a: any[]) => getSongMock(...a),
  StorageWriteError: StorageWriteErrorMock,
}));
const buildSharePayloadMock = vi.fn((..._a: any[]) => ({ encoded: 'ENC', titlesDropped: false }));
vi.mock('../lib/share', () => ({
  buildSharePayload: (...a: any[]) => buildSharePayloadMock(...a),
}));

// reResolve only works in a real browser (YT iframe). Mock the resolver hook.
const reResolveMock = vi.fn();
vi.mock('../hooks/useSongResolver', () => ({
  useSongResolver: () => ({ resolve: vi.fn(), reResolve: reResolveMock, resolving: false }),
}));

let lastOnAdd: ((s: Song) => void) | null = null;
vi.mock('../components/PasteInput', () => ({
  default: ({ onAdd }: any) => { lastOnAdd = onAdd; return <div data-testid="paste-input" />; },
}));
vi.mock('../components/SongCard', () => ({
  default: ({ song, onShare }: any) => (
    <div data-testid="song-card">
      {song.title}
      {onShare ? <button aria-label="이 곡만 보내기" onClick={onShare} /> : null}
    </div>
  ),
}));
vi.mock('../components/QrShare', () => ({
  default: ({ url }: any) => <div data-testid="qr-share">{url}</div>,
}));

import Editor from './Editor';

const song = (id: string): Song => ({
  id, title: 'song-' + id, artist: 'a', durationSec: 100,
  cover: 'c', colors: { gradientFrom: '#111', gradientTo: '#000', accent: '#abc' },
  lyrics: { type: 'none', source: 'none', offsetMs: 0 }, resolvedAt: '2026-06-20',
});
const pl = (songIds: string[]): Playlist => ({
  id: 'pl1', title: 'My List', message: 'hi', songIds, createdAt: '2026-06-20',
});

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={['/edit/pl1']}>
      <Routes><Route path="/edit/:playlistId" element={<Editor />} /></Routes>
    </MemoryRouter>,
  );
}

describe('Editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastOnAdd = null;
    getPlaylistMock.mockReturnValue(pl(['s0']));
    getSongMock.mockImplementation((id: string) => song(id));
  });

  it('renders existing song cards and the paste input', () => {
    renderEditor();
    expect(screen.getByTestId('paste-input')).toBeInTheDocument();
    expect(screen.getByText('song-s0')).toBeInTheDocument();
  });

  it('PasteInput.onAdd appends to songIds and saves', () => {
    renderEditor();
    expect(lastOnAdd).toBeTypeOf('function');
    lastOnAdd!(song('s1'));
    expect(savePlaylistMock).toHaveBeenCalled();
    const calls = savePlaylistMock.mock.calls;
    const saved = calls[calls.length - 1][0] as Playlist;
    expect(saved.songIds).toEqual(['s0', 's1']);
  });

  it('editing the title saves the playlist', async () => {
    renderEditor();
    const input = screen.getByLabelText('제목') as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, 'Renamed');
    expect(savePlaylistMock).toHaveBeenCalled();
    const calls = savePlaylistMock.mock.calls;
    const saved = calls[calls.length - 1][0] as Playlist;
    expect(saved.title).toBe('Renamed');
  });

  it('moving a song up reorders and saves', async () => {
    getPlaylistMock.mockReturnValue(pl(['s0', 's1', 's2']));
    renderEditor();
    const ups = screen.getAllByRole('button', { name: '위로' });
    await userEvent.click(ups[1]); // move s1 up
    const calls = savePlaylistMock.mock.calls;
    const saved = calls[calls.length - 1][0] as Playlist;
    expect(saved.songIds).toEqual(['s1', 's0', 's2']);
  });

  it('deleting a song removes it and saves', async () => {
    getPlaylistMock.mockReturnValue(pl(['s0', 's1', 's2']));
    renderEditor();
    const dels = screen.getAllByRole('button', { name: '삭제' });
    await userEvent.click(dels[1]); // delete s1
    const calls = savePlaylistMock.mock.calls;
    const saved = calls[calls.length - 1][0] as Playlist;
    expect(saved.songIds).toEqual(['s0', 's2']);
  });

  it('P0-4: a quota error while persisting alerts and keeps the edit out of state', async () => {
    savePlaylistMock.mockImplementation(() => { throw new StorageWriteErrorMock('full'); });
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderEditor();
    const input = screen.getByLabelText('제목') as HTMLInputElement;
    await userEvent.type(input, 'x');
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('저장 공간이 가득'));
    // input still shows the persisted (unchanged) title, not the un-saved keystroke
    expect((screen.getByLabelText('제목') as HTMLInputElement).value).toBe('My List');
    alertSpy.mockRestore();
  });

  it('clicking "가사/메타 다시 찾기" calls reResolve(song.id)', async () => {
    reResolveMock.mockResolvedValue(song('s0'));
    renderEditor();
    const btn = screen.getByRole('button', { name: '가사/메타 다시 찾기' });
    await userEvent.click(btn);
    await waitFor(() => expect(reResolveMock).toHaveBeenCalledWith('s0'));
  });

  it('"이 곡만 보내기" reveals a single-song share built from exactly one song', async () => {
    getPlaylistMock.mockReturnValue(pl(['s0', 's1', 's2']));
    renderEditor();
    expect(screen.queryByTestId('single-share')).toBeNull();
    buildSharePayloadMock.mockClear();
    const shareButtons = screen.getAllByRole('button', { name: '이 곡만 보내기' });
    await userEvent.click(shareButtons[1]); // share the second song (s1)
    // inline single-song QR reveal appears
    expect(screen.getByTestId('single-share')).toBeInTheDocument();
    // and the payload was built with a songs array of length exactly 1
    const singleCall = buildSharePayloadMock.mock.calls.find(
      (c: any[]) => Array.isArray(c[1]) && c[1].length === 1,
    );
    expect(singleCall).toBeTruthy();
    expect((singleCall as any[])[1]).toEqual([{ id: 's1', title: 'song-s1' }]);
  });
});
