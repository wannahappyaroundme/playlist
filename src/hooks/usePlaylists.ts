import { useCallback, useState } from 'react';
import type { Playlist } from '../types';
import {
  loadPlaylists,
  getPlaylist,
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

  // 제목만 바꿔 저장한다(quota 실패면 안내만 하고 상태는 그대로 둔다).
  const rename = useCallback((id: string, title: string) => {
    const p = getPlaylist(id);
    if (!p) return; // 없는 id면 조용히 무시
    try {
      savePlaylist({ ...p, title });
    } catch (err) {
      if (err instanceof StorageWriteError) {
        window.alert(QUOTA_MSG);
        return;
      }
      throw err;
    }
    setPlaylists(loadPlaylists());
  }, []);

  // 같은 내용으로 새 플레이리스트를 만든다("(사본)" 접미사). quota 초과면 null을 반환.
  const duplicate = useCallback((id: string): Playlist | null => {
    const src = getPlaylist(id);
    if (!src) return null;
    const copy = createPlaylist(`${src.title} (사본)`);
    const withContent: Playlist = {
      ...copy,
      songIds: [...src.songIds],
      message: src.message,
      from: src.from,
      color: src.color,
      coverVideoId: src.coverVideoId,
    };
    try {
      savePlaylist(withContent);
    } catch (err) {
      if (err instanceof StorageWriteError) {
        window.alert(QUOTA_MSG);
        return null;
      }
      throw err;
    }
    setPlaylists(loadPlaylists());
    return withContent;
  }, []);

  const remove = useCallback((id: string) => {
    deletePlaylist(id);
    setPlaylists(loadPlaylists());
  }, []);

  return { playlists, refresh, create, rename, duplicate, remove };
}
