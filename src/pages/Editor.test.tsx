import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
const buildSharePayloadMock = vi.fn((..._a: any[]) => ({
  encoded: 'ENC',
  titlesDropped: false,
  tooLong: false,
}));
vi.mock('../lib/share', () => ({
  buildSharePayload: (...a: any[]) => buildSharePayloadMock(...a),
}));

// reResolve only works in a real browser (YT iframe). Mock the resolver hook.
const reResolveMock = vi.fn();
vi.mock('../hooks/useSongResolver', () => ({
  useSongResolver: () => ({ resolve: vi.fn(), reResolve: reResolveMock, resolving: false }),
}));

let lastOnAdd: ((s: Song[]) => void) | null = null;
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
    // clearAllMocks only clears call history (not implementations) — restore the
    // default share payload so per-test mockReturnValue overrides don't leak.
    buildSharePayloadMock.mockReturnValue({ encoded: 'ENC', titlesDropped: false, tooLong: false });
  });

  it('renders existing song cards and the paste input', () => {
    renderEditor();
    expect(screen.getByTestId('paste-input')).toBeInTheDocument();
    expect(screen.getByText('song-s0')).toBeInTheDocument();
  });

  it('PasteInput.onAdd appends to songIds and saves', () => {
    renderEditor();
    expect(lastOnAdd).toBeTypeOf('function');
    lastOnAdd!([song('s1')]);
    expect(savePlaylistMock).toHaveBeenCalled();
    const calls = savePlaylistMock.mock.calls;
    const saved = calls[calls.length - 1][0] as Playlist;
    expect(saved.songIds).toEqual(['s0', 's1']);
  });

  it('onAdd appends MANY songs in order in a single save (batch add)', () => {
    renderEditor();
    savePlaylistMock.mockClear();
    lastOnAdd!([song('s1'), song('s2'), song('s3')]);
    // exactly one persist, all three appended in order (no stale-closure last-wins)
    expect(savePlaylistMock).toHaveBeenCalledTimes(1);
    const saved = savePlaylistMock.mock.calls[0][0] as Playlist;
    expect(saved.songIds).toEqual(['s0', 's1', 's2', 's3']);
  });

  it('P0-3: onAdd ignores a song already in the playlist and alerts', () => {
    // playlist already contains s0 (default fixture)
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderEditor();
    savePlaylistMock.mockClear();
    lastOnAdd!([song('s0')]); // re-add the same id
    expect(alertSpy).toHaveBeenCalledWith('이미 담긴 곡이에요');
    expect(savePlaylistMock).not.toHaveBeenCalled(); // not persisted, no [s0,s0]
    alertSpy.mockRestore();
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

  it('P1-A: clicking "대표로" persists coverVideoId = that song id', async () => {
    getPlaylistMock.mockReturnValue(pl(['s0', 's1', 's2']));
    renderEditor();
    const covers = screen.getAllByRole('button', { name: '대표로' });
    await userEvent.click(covers[1]); // make s1 the cover
    const calls = savePlaylistMock.mock.calls;
    const saved = calls[calls.length - 1][0] as Playlist;
    expect(saved.coverVideoId).toBe('s1');
  });

  it('P1-A: an explicit cover survives a reorder (no longer forced to songIds[0])', async () => {
    getPlaylistMock.mockReturnValue(pl(['s0', 's1', 's2']));
    renderEditor();
    // pin s1 as cover
    const covers = screen.getAllByRole('button', { name: '대표로' });
    await userEvent.click(covers[1]);
    // now reorder: move s0 down (or s2 up) — cover must stay s1, not become songIds[0]
    const downs = screen.getAllByRole('button', { name: '아래로' });
    await userEvent.click(downs[0]); // s0 <-> s1 => order [s1, s0, s2]
    const calls = savePlaylistMock.mock.calls;
    const saved = calls[calls.length - 1][0] as Playlist;
    expect(saved.coverVideoId).toBe('s1'); // preserved, not overwritten to songIds[0]
  });

  it('P1-A: persist defaults coverVideoId to songIds[0] when none is pinned', () => {
    getPlaylistMock.mockReturnValue(pl(['s0', 's1']));
    renderEditor();
    lastOnAdd!([song('s2')]); // any persist
    const calls = savePlaylistMock.mock.calls;
    const saved = calls[calls.length - 1][0] as Playlist;
    expect(saved.coverVideoId).toBe('s0');
  });

  it('P1-A: a pinned cover that is removed falls back to songIds[0]', async () => {
    getPlaylistMock.mockReturnValue(pl(['s0', 's1', 's2']));
    renderEditor();
    const covers = screen.getAllByRole('button', { name: '대표로' });
    await userEvent.click(covers[1]); // pin s1
    const dels = screen.getAllByRole('button', { name: '삭제' });
    await userEvent.click(dels[1]); // remove s1 => songIds [s0, s2]
    const calls = savePlaylistMock.mock.calls;
    const saved = calls[calls.length - 1][0] as Playlist;
    expect(saved.songIds).toEqual(['s0', 's2']);
    expect(saved.coverVideoId).toBe('s0'); // pinned cover gone → fall back
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
    // compact 포맷은 곡 제목을 URL에 넣지 않으므로 id만 전달한다
    expect((singleCall as any[])[1]).toEqual([{ id: 's1' }]);
  });

  // ---- Item 1: search / filter ----
  const sixIds = ['s0', 's1', 's2', 's3', 's4', 's5'];

  it('search box is hidden for small playlists (<= 5 songs)', () => {
    getPlaylistMock.mockReturnValue(pl(['s0', 's1', 's2']));
    renderEditor();
    expect(screen.queryByLabelText('곡 검색')).toBeNull();
  });

  it('search box appears once there are more than 5 songs', () => {
    getPlaylistMock.mockReturnValue(pl(sixIds));
    renderEditor();
    expect(screen.getByLabelText('곡 검색')).toBeInTheDocument();
  });

  it('typing a query filters the shown song cards and shows the n곡 중 m곡 count', async () => {
    getPlaylistMock.mockReturnValue(pl(sixIds));
    renderEditor();
    const box = screen.getByLabelText('곡 검색');
    await userEvent.type(box, 's3');
    // only the matching card is rendered
    expect(screen.getByText('song-s3')).toBeInTheDocument();
    expect(screen.queryByText('song-s0')).toBeNull();
    // count + reorder-off hint
    expect(screen.getByText('6곡 중 1곡')).toBeInTheDocument();
    expect(screen.getByText('검색 중에는 순서 변경이 꺼져요')).toBeInTheDocument();
  });

  it('reorder controls (↑/↓) are hidden while filtering', async () => {
    getPlaylistMock.mockReturnValue(pl(sixIds));
    renderEditor();
    expect(screen.getAllByRole('button', { name: '위로' }).length).toBe(6);
    await userEvent.type(screen.getByLabelText('곡 검색'), 's3');
    expect(screen.queryByRole('button', { name: '위로' })).toBeNull();
    expect(screen.queryByRole('button', { name: '아래로' })).toBeNull();
  });

  it('deleting while filtering removes the correct song by id (no off-by-index)', async () => {
    getPlaylistMock.mockReturnValue(pl(sixIds));
    renderEditor();
    await userEvent.type(screen.getByLabelText('곡 검색'), 's4');
    // only one delete button is shown (for the filtered s4); it must remove s4, not index-4 of filtered view
    const dels = screen.getAllByRole('button', { name: '삭제' });
    expect(dels).toHaveLength(1);
    await userEvent.click(dels[0]);
    const calls = savePlaylistMock.mock.calls;
    const saved = calls[calls.length - 1][0] as Playlist;
    expect(saved.songIds).toEqual(['s0', 's1', 's2', 's3', 's5']); // s4 gone, rest intact
  });

  it('clearing the query restores the full list and reorder controls', async () => {
    getPlaylistMock.mockReturnValue(pl(sixIds));
    renderEditor();
    const box = screen.getByLabelText('곡 검색');
    await userEvent.type(box, 's3');
    expect(screen.queryByText('song-s0')).toBeNull();
    await userEvent.clear(box);
    expect(screen.getByText('song-s0')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '위로' }).length).toBe(6);
  });

  // ---- Item 2: drag reorder ----
  // NOTE: jsdom cannot simulate a real pointer drag (DataTransfer, drag image,
  // touch). We exercise the React onDragStart/onDrop wiring via fireEvent here;
  // the actual drag *interaction* is manual-verified in a real browser. The
  // reorder math itself is covered exhaustively in src/lib/editor.test.ts.
  it('dragging a row onto another reorders songIds via persist (onDragStart→onDrop)', () => {
    getPlaylistMock.mockReturnValue(pl(['s0', 's1', 's2']));
    const { container } = renderEditor();
    const rows = container.querySelectorAll('li[draggable="true"]');
    expect(rows).toHaveLength(3);
    // drag s0 (row 0) onto s2 (row 2); fireEvent wraps each in act() so the
    // dragId state set by dragStart is flushed before drop reads it.
    fireEvent.dragStart(rows[0]);
    fireEvent.dragOver(rows[2]);
    fireEvent.drop(rows[2]);
    const calls = savePlaylistMock.mock.calls;
    const saved = calls[calls.length - 1][0] as Playlist;
    expect(saved.songIds).toEqual(['s1', 's2', 's0']); // s0 moved to s2's slot
  });

  it('rows are not draggable while filtering', async () => {
    getPlaylistMock.mockReturnValue(pl(sixIds));
    const { container } = renderEditor();
    expect(container.querySelectorAll('li[draggable="true"]').length).toBe(6);
    await userEvent.type(screen.getByLabelText('곡 검색'), 's3');
    expect(container.querySelectorAll('li[draggable="true"]').length).toBe(0);
  });

  // ---- Item 3: share-length warnings ----
  it('shows the title-dropped note when titlesDropped is true', () => {
    buildSharePayloadMock.mockReturnValue({ encoded: 'ENC', titlesDropped: true, tooLong: false });
    getPlaylistMock.mockReturnValue(pl(['s0', 's1']));
    renderEditor();
    expect(screen.getByText('곡이 많아 공유 링크에서 곡 제목은 생략돼요')).toBeInTheDocument();
  });

  it('shows the stronger broken-link warning when tooLong is true', () => {
    buildSharePayloadMock.mockReturnValue({ encoded: 'ENC', titlesDropped: true, tooLong: true });
    getPlaylistMock.mockReturnValue(pl(['s0', 's1']));
    renderEditor();
    expect(
      screen.getByText('곡이 너무 많아 공유 링크가 깨질 수 있어요 — 곡 수를 줄여주세요'),
    ).toBeInTheDocument();
    // and not the milder note (tooLong takes precedence)
    expect(screen.queryByText('곡이 많아 공유 링크에서 곡 제목은 생략돼요')).toBeNull();
  });

  it('shows the soft ~50곡 hint for large playlists when nothing was dropped', () => {
    buildSharePayloadMock.mockReturnValue({ encoded: 'ENC', titlesDropped: false, tooLong: false });
    getPlaylistMock.mockReturnValue(pl(Array.from({ length: 41 }, (_, i) => 's' + i)));
    renderEditor();
    expect(screen.getByText('공유는 약 50곡까지 권장해요')).toBeInTheDocument();
  });
});
