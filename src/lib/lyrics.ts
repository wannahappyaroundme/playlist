import type { SongLyrics } from '../types';

/**
 * 화면에 보여줄 가사가 실제로 있는지(순수).
 * - synced: 줄이 1개 이상
 * - plain: 공백이 아닌 텍스트
 * - none: 항상 false
 * Player/SharedView는 이게 false면 가사 칸을 없애고 LP(앨범+디스크)만 가운데 띄운다.
 */
export function hasDisplayableLyrics(l: SongLyrics): boolean {
  if (l.type === 'synced') return (l.synced?.length ?? 0) > 0;
  if (l.type === 'plain') return !!l.plain && l.plain.trim().length > 0;
  return false;
}
