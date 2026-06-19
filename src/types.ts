export type RepeatMode = 'off' | 'all' | 'one';
export type LyricsType = 'synced' | 'plain' | 'none';

export interface LyricLine {
  time: number; // time = 초(float)
  text: string;
}

export interface SongColors {
  gradientFrom: string;
  gradientTo: string;
  accent: string;
}

export interface SongLyrics {
  type: LyricsType;
  synced?: LyricLine[];
  plain?: string;
  source: 'lrclib' | 'manual' | 'none';
  offsetMs: number;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  durationSec: number;
  cover: string;
  colors: SongColors;
  lyrics: SongLyrics;
  resolvedAt: string;
}

export interface Playlist {
  id: string;
  title: string;
  message?: string;
  coverVideoId?: string;
  songIds: string[];
  createdAt: string;
}

export interface SharedPlaylist {
  title: string;
  message?: string;
  songs: { id: string; title?: string }[];
}
