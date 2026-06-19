import { useCallback, useState } from 'react';
import type { Playlist } from '../types';
import { loadPlaylists, createPlaylist, savePlaylist, deletePlaylist } from '../lib/storage';

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>(() => loadPlaylists());

  const refresh = useCallback(() => {
    setPlaylists(loadPlaylists());
  }, []);

  const create = useCallback((title: string): Playlist => {
    const p = createPlaylist(title);
    savePlaylist(p);
    setPlaylists(loadPlaylists());
    return p;
  }, []);

  const remove = useCallback((id: string) => {
    deletePlaylist(id);
    setPlaylists(loadPlaylists());
  }, []);

  return { playlists, refresh, create, remove };
}
