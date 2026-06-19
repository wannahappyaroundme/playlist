import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import type { Playlist } from '../types';

const createMock = vi.fn();
const removeMock = vi.fn();
let playlistsMock: Playlist[] = [];

vi.mock('../hooks/usePlaylists', () => ({
  usePlaylists: () => ({ playlists: playlistsMock, refresh: vi.fn(), create: createMock, remove: removeMock }),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

import Gallery from './Gallery';

const mk = (id: string, title: string): Playlist => ({
  id, title, songIds: [], createdAt: '2026-06-20T00:00:00.000Z',
});

function renderGallery() {
  return render(<MemoryRouter initialEntries={['/']}><Gallery /></MemoryRouter>);
}

describe('Gallery', () => {
  beforeEach(() => { vi.clearAllMocks(); playlistsMock = []; });

  it('shows the brand title "Yejin Playlist"', () => {
    renderGallery();
    expect(screen.getByText('Yejin Playlist')).toBeInTheDocument();
  });

  it('renders a card for each playlist with a link', () => {
    playlistsMock = [mk('aa', 'Late Night'), mk('bb', 'Morning')];
    renderGallery();
    expect(screen.getByText('Late Night')).toBeInTheDocument();
    expect(screen.getByText('Morning')).toBeInTheDocument();
    const links = screen.getAllByRole('link').map(a => a.getAttribute('href'));
    expect(links.some(h => h?.includes('/p/aa'))).toBe(true);
    expect(links.some(h => h?.includes('/p/bb'))).toBe(true);
  });

  it('shows an empty-state hint when there are no playlists', () => {
    playlistsMock = [];
    renderGallery();
    // The literal "새 플레이리스트" appears in both the button and the hint copy,
    // so target the empty-state's distinct line to avoid a multi-match getByText.
    expect(screen.getByText('아직 플레이리스트가 없어요.')).toBeInTheDocument();
  });

  it('clicking "새 플레이리스트" creates a playlist and navigates to its editor', async () => {
    createMock.mockReturnValue(mk('genid', '새 플레이리스트'));
    renderGallery();
    await userEvent.setup().click(screen.getByRole('button', { name: '새 플레이리스트' }));
    expect(createMock).toHaveBeenCalledWith('새 플레이리스트');
    expect(navigateMock).toHaveBeenCalledWith('/edit/genid');
  });
});
