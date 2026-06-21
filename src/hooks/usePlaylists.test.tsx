import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Playlist } from '../types';

const { StorageWriteErrorMock } = vi.hoisted(() => ({ StorageWriteErrorMock: class extends Error {} }));
vi.mock('../lib/storage', () => ({
  loadPlaylists: vi.fn(),
  getPlaylist: vi.fn(),
  createPlaylist: vi.fn(),
  savePlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
  StorageWriteError: StorageWriteErrorMock,
}));

import * as storage from '../lib/storage';
import { usePlaylists } from './usePlaylists';

const mk = (id: string): Playlist => ({
  id, title: 't-' + id, songIds: [], createdAt: '2026-06-20T00:00:00.000Z',
});

describe('usePlaylists', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('exposes playlists from storage on mount', () => {
    (storage.loadPlaylists as any).mockReturnValue([mk('a'), mk('b')]);
    const { result } = renderHook(() => usePlaylists());
    expect(result.current.playlists.map(p => p.id)).toEqual(['a', 'b']);
  });

  it('refresh re-reads storage', () => {
    (storage.loadPlaylists as any).mockReturnValueOnce([mk('a')]).mockReturnValue([mk('a'), mk('c')]);
    const { result } = renderHook(() => usePlaylists());
    expect(result.current.playlists).toHaveLength(1);
    act(() => result.current.refresh());
    expect(result.current.playlists.map(p => p.id)).toEqual(['a', 'c']);
  });

  it('create calls storage.createPlaylist + savePlaylist and updates state', () => {
    const created = mk('new');
    (storage.loadPlaylists as any).mockReturnValueOnce([]).mockReturnValue([created]);
    (storage.createPlaylist as any).mockReturnValue(created);
    const { result } = renderHook(() => usePlaylists());
    let returned: Playlist | null | undefined;
    act(() => { returned = result.current.create('My List'); });
    expect(storage.createPlaylist).toHaveBeenCalledWith('My List');
    expect(storage.savePlaylist).toHaveBeenCalledWith(created);
    expect(returned).toEqual(created);
    expect(result.current.playlists.map(p => p.id)).toEqual(['new']);
  });

  it('P0-4: create returns null and alerts when storage is full (no state change)', () => {
    (storage.loadPlaylists as any).mockReturnValue([]);
    (storage.createPlaylist as any).mockReturnValue(mk('new'));
    (storage.savePlaylist as any).mockImplementation(() => { throw new StorageWriteErrorMock('full'); });
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => usePlaylists());
    let returned: Playlist | null | undefined;
    act(() => { returned = result.current.create('My List'); });
    expect(returned).toBeNull();
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('저장 공간이 가득'));
    expect(result.current.playlists).toEqual([]); // unchanged
    alertSpy.mockRestore();
  });

  it('P1-B: rename loads the playlist, sets title, saves, and refreshes', () => {
    (storage.savePlaylist as any).mockImplementation(() => {}); // success (clear any leaked throw)
    const before = mk('a'); // title 't-a'
    (storage.getPlaylist as any).mockReturnValue(before);
    (storage.loadPlaylists as any)
      .mockReturnValueOnce([before])
      .mockReturnValue([{ ...before, title: 'Renamed' }]);
    const { result } = renderHook(() => usePlaylists());
    act(() => result.current.rename('a', 'Renamed'));
    expect(storage.getPlaylist).toHaveBeenCalledWith('a');
    expect(storage.savePlaylist).toHaveBeenCalledWith({ ...before, title: 'Renamed' });
    expect(result.current.playlists.map((p) => p.title)).toEqual(['Renamed']);
  });

  it('P1-B: rename is a no-op when the playlist is missing', () => {
    (storage.getPlaylist as any).mockReturnValue(undefined);
    (storage.loadPlaylists as any).mockReturnValue([]);
    const { result } = renderHook(() => usePlaylists());
    act(() => result.current.rename('nope', 'X'));
    expect(storage.savePlaylist).not.toHaveBeenCalled();
  });

  it('P1-B: rename alerts and keeps state on a quota error', () => {
    const before = mk('a');
    (storage.getPlaylist as any).mockReturnValue(before);
    (storage.loadPlaylists as any).mockReturnValue([before]);
    (storage.savePlaylist as any).mockImplementation(() => { throw new StorageWriteErrorMock('full'); });
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => usePlaylists());
    act(() => result.current.rename('a', 'Renamed'));
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('저장 공간이 가득'));
    expect(result.current.playlists.map((p) => p.title)).toEqual(['t-a']); // unchanged
    alertSpy.mockRestore();
  });

  it('P1-B: duplicate copies content into a new playlist with a distinct id + (사본) title', () => {
    (storage.savePlaylist as any).mockImplementation(() => {}); // success (clear any leaked throw)
    const src: Playlist = {
      id: 'src', title: 'Mix', songIds: ['x', 'y'], message: 'hi', from: 'me',
      color: '#abc', coverVideoId: 'y', createdAt: '2026-06-20T00:00:00.000Z',
    };
    const copy = mk('copyid');
    (storage.getPlaylist as any).mockReturnValue(src);
    (storage.createPlaylist as any).mockReturnValue(copy);
    (storage.loadPlaylists as any).mockReturnValueOnce([src]).mockReturnValue([src, copy]);
    const { result } = renderHook(() => usePlaylists());
    let returned: Playlist | null | undefined;
    act(() => { returned = result.current.duplicate('src'); });
    expect(storage.createPlaylist).toHaveBeenCalledWith('Mix (사본)');
    const saved = (storage.savePlaylist as any).mock.calls[0][0] as Playlist;
    expect(saved.id).toBe('copyid'); // distinct id from the source
    expect(saved.songIds).toEqual(['x', 'y']);
    expect(saved.message).toBe('hi');
    expect(saved.from).toBe('me');
    expect(saved.color).toBe('#abc');
    expect(saved.coverVideoId).toBe('y');
    expect(returned).not.toBeNull();
  });

  it('P1-B: duplicate returns null on a quota error', () => {
    const src: Playlist = { id: 'src', title: 'Mix', songIds: ['x'], createdAt: 'x' };
    (storage.getPlaylist as any).mockReturnValue(src);
    (storage.createPlaylist as any).mockReturnValue(mk('copyid'));
    (storage.savePlaylist as any).mockImplementation(() => { throw new StorageWriteErrorMock('full'); });
    (storage.loadPlaylists as any).mockReturnValue([src]);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => usePlaylists());
    let returned: Playlist | null | undefined;
    act(() => { returned = result.current.duplicate('src'); });
    expect(returned).toBeNull();
    alertSpy.mockRestore();
  });

  it('P1-B: duplicate returns null when the source is missing', () => {
    (storage.getPlaylist as any).mockReturnValue(undefined);
    (storage.loadPlaylists as any).mockReturnValue([]);
    const { result } = renderHook(() => usePlaylists());
    let returned: Playlist | null | undefined;
    act(() => { returned = result.current.duplicate('nope'); });
    expect(returned).toBeNull();
    expect(storage.createPlaylist).not.toHaveBeenCalled();
  });

  it('remove calls storage.deletePlaylist and refreshes', () => {
    (storage.loadPlaylists as any).mockReturnValueOnce([mk('a'), mk('b')]).mockReturnValue([mk('b')]);
    const { result } = renderHook(() => usePlaylists());
    act(() => result.current.remove('a'));
    expect(storage.deletePlaylist).toHaveBeenCalledWith('a');
    expect(result.current.playlists.map(p => p.id)).toEqual(['b']);
  });
});
