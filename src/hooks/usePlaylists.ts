import { useCallback, useState } from 'react';
import type { Playlist } from '../types';
import {
  loadPlaylists,
  createPlaylist,
  savePlaylist,
  deletePlaylist,
  StorageWriteError,
} from '../lib/storage';

const QUOTA_MSG = '저장 공간이 가득 찼어요 — 갤러리에서 내보내기로 백업 후 정리해 주세요';

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>(() => loadPlaylists());

  const refresh = useCallback(() => {
    setPlaylists(loadPlaylists());
  }, []);

  // 저장 성공 시 새 플레이리스트를, quota 초과면 null을 반환한다(호출부가 반쪽 저장 상태로 이동하지 않게).
  const create = useCallback((title: string): Playlist | null => {
    const p = createPlaylist(title);
    try {
      savePlaylist(p);
    } catch (err) {
      if (err instanceof StorageWriteError) {
        window.alert(QUOTA_MSG);
        return null; // 저장 안 됨 → 상태 갱신/이동 안 함
      }
      throw err;
    }
    setPlaylists(loadPlaylists());
    return p;
  }, []);

  const remove = useCallback((id: string) => {
    deletePlaylist(id);
    setPlaylists(loadPlaylists());
  }, []);

  return { playlists, refresh, create, remove };
}
