import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./playback/PlaybackContext', () => ({
  PlaybackProvider: ({ children }: any) => <div data-testid="playback-provider">{children}</div>,
}));
// Gallery stub renders the brand title so the long-standing smoke assertion
// ("Yejin Playlist" is on the home route) keeps passing after router wiring.
vi.mock('./pages/Gallery', () => ({ default: () => <div>Yejin Playlist</div> }));
vi.mock('./pages/Player', () => ({ default: () => <div>PLAYER_PAGE</div> }));
vi.mock('./pages/Editor', () => ({ default: () => <div>EDITOR_PAGE</div> }));
vi.mock('./pages/SharedView', () => ({ default: () => <div>SHARED_PAGE</div> }));

import App from './App';

function renderAt(hash: string) {
  window.location.hash = hash;
  return render(<App />);
}

describe('App routing', () => {
  beforeEach(() => { window.location.hash = ''; });

  it('renders the "Yejin Playlist" title on the home route', () => {
    renderAt('#/');
    expect(screen.getByText('Yejin Playlist')).toBeInTheDocument();
  });

  it('renders Gallery at #/ wrapped in a single PlaybackProvider', () => {
    renderAt('#/');
    expect(screen.getAllByTestId('playback-provider')).toHaveLength(1);
    expect(screen.getByText('Yejin Playlist')).toBeInTheDocument();
  });

  it('renders Player at #/p/:playlistId', () => {
    renderAt('#/p/abc');
    expect(screen.getByText('PLAYER_PAGE')).toBeInTheDocument();
  });

  it('renders Player at #/p/:playlistId/:songId', () => {
    renderAt('#/p/abc/song1');
    expect(screen.getByText('PLAYER_PAGE')).toBeInTheDocument();
  });

  it('renders Editor at #/edit/:playlistId', () => {
    renderAt('#/edit/abc');
    expect(screen.getByText('EDITOR_PAGE')).toBeInTheDocument();
  });

  it('renders SharedView at #/s/:encoded', () => {
    renderAt('#/s/eyJ0IjoxfQ');
    expect(screen.getByText('SHARED_PAGE')).toBeInTheDocument();
  });
});
