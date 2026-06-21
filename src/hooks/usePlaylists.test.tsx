import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Playlist } from '../types';

const { StorageWriteErrorMock } = vi.hoisted(() => ({ StorageWriteErrorMock: class extends Error {} }));
vi.mock('../lib/storage', () => ({
  loadPlaylists: vi.fn(),
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
    let returned: Playlist | undefined;
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

  it('remove calls storage.deletePlaylist and refreshes', () => {
    (storage.loadPlaylists as any).mockReturnValueOnce([mk('a'), mk('b')]).mockReturnValue([mk('b')]);
    const { result } = renderHook(() => usePlaylists());
    act(() => result.current.remove('a'));
    expect(storage.deletePlaylist).toHaveBeenCalledWith('a');
    expect(result.current.playlists.map(p => p.id)).toEqual(['b']);
  });
});
