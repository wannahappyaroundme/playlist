export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export interface YtPlayerVars {
  playsinline: 1;
  controls: 0;
  rel: 0;
  modestbranding: 1;
  origin: string;
}

export function buildPlayerVars(origin: string): YtPlayerVars {
  return {
    playsinline: 1,
    controls: 0,
    rel: 0,
    modestbranding: 1,
    origin,
  };
}

export const IFRAME_API_SRC = 'https://www.youtube.com/iframe_api';

export function ensureIframeApiScript(doc: Document = document): boolean {
  const existing = doc.querySelector(`script[src="${IFRAME_API_SRC}"]`);
  if (existing) return false;
  const tag = doc.createElement('script');
  tag.src = IFRAME_API_SRC;
  const first = doc.getElementsByTagName('script')[0];
  if (first && first.parentNode) {
    first.parentNode.insertBefore(tag, first);
  } else {
    doc.head.appendChild(tag);
  }
  return true;
}

export interface YtPlayer {
  loadVideoById(id: string): void;
  cueVideoById(id: string): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(sec: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getVideoData(): { video_id: string; title: string; author: string };
  getPlayerState(): number;
  destroy(): void;
}

export interface YtPlayerEvents {
  onReady?(): void;
  onStateChange?(state: number): void;
  onError?(code: number): void;
}

// minimal ambient typing for the global YT namespace + ready callback
declare global {
  interface Window {
    YT?: {
      Player: new (
        el: string | HTMLElement,
        opts: {
          videoId?: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: () => void;
            onStateChange?: (e: { data: number }) => void;
            onError?: (e: { data: number }) => void;
          };
        },
      ) => YtPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiReady: Promise<void> | null = null;

function whenApiReady(): Promise<void> {
  if (apiReady) return apiReady;
  apiReady = new Promise<void>((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    ensureIframeApiScript(document);
  });
  return apiReady;
}

export async function createYtPlayer(
  elementId: string,
  events: YtPlayerEvents,
): Promise<YtPlayer> {
  await whenApiReady();
  return new Promise<YtPlayer>((resolve) => {
    const player = new window.YT!.Player(elementId, {
      playerVars: buildPlayerVars(window.location.origin) as unknown as Record<string, unknown>,
      events: {
        onReady: () => {
          events.onReady?.();
          resolve(player);
        },
        onStateChange: (e) => events.onStateChange?.(e.data),
        onError: (e) => events.onError?.(e.data),
      },
    });
  });
}
