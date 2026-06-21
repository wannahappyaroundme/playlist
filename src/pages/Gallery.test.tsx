import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import type { Playlist } from '../types';

const createMock = vi.fn();
const removeMock = vi.fn();
const renameMock = vi.fn();
const duplicateMock = vi.fn();
let playlistsMock: Playlist[] = [];

vi.mock('../hooks/usePlaylists', () => ({
  usePlaylists: () => ({
    playlists: playlistsMock,
    refresh: vi.fn(),
    create: createMock,
    rename: renameMock,
    duplicate: duplicateMock,
    remove: removeMock,
  }),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

import Gallery from './Gallery';
import * as storage from '../lib/storage';

const mk = (id: string, title: string, over: Partial<Playlist> = {}): Playlist => ({
  id, title, songIds: [], createdAt: '2026-06-20T00:00:00.000Z', ...over,
});

function renderGallery() {
  return render(<MemoryRouter initialEntries={['/']}><Gallery /></MemoryRouter>);
}

describe('Gallery', () => {
  beforeEach(() => { vi.clearAllMocks(); playlistsMock = []; localStorage.clear(); });

  it('shows the brand title "Yejin Playlist"', () => {
    renderGallery();
    expect(screen.getByText('Yejin Playlist')).toBeInTheDocument();
  });

  it('sweeps orphan pool songs once on mount (GC)', () => {
    const sweepSpy = vi.spyOn(storage, 'sweepOrphans').mockReturnValue(0);
    renderGallery();
    expect(sweepSpy).toHaveBeenCalledTimes(1);
    sweepSpy.mockRestore();
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

  it('renders a cover thumbnail img when coverVideoId is set (Fix 16)', () => {
    playlistsMock = [mk('aa', 'Late Night', { coverVideoId: 'vid12345678', songIds: ['vid12345678'] })];
    renderGallery();
    const img = screen.getByTestId('gallery-cover-aa') as HTMLImageElement;
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toContain('vid12345678');
  });

  it('shows a placeholder (no img) when coverVideoId is absent (Fix 16)', () => {
    playlistsMock = [mk('bb', 'Empty One')];
    renderGallery();
    expect(screen.queryByTestId('gallery-cover-bb')).toBeNull();
    expect(screen.getByTestId('gallery-cover-empty-bb')).toBeInTheDocument();
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

  it('clicking 삭제 with a confirmed prompt calls remove(id)', async () => {
    playlistsMock = [mk('aa', 'Late Night')];
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderGallery();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Late Night 삭제' }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(removeMock).toHaveBeenCalledWith('aa');
    confirmSpy.mockRestore();
  });

  it('cancelling the delete prompt does not call remove', async () => {
    playlistsMock = [mk('aa', 'Late Night')];
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderGallery();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Late Night 삭제' }));
    expect(removeMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('P1-B: clicking 이름변경 swaps the title for an input that commits on Enter', async () => {
    playlistsMock = [mk('aa', 'Late Night')];
    renderGallery();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Late Night 이름변경' }));
    const input = screen.getByLabelText('이름 변경') as HTMLInputElement;
    await userEvent.setup().clear(input);
    await userEvent.setup().type(input, 'New Name{Enter}');
    expect(renameMock).toHaveBeenCalledWith('aa', 'New Name');
  });

  it('P1-B: rename input commits on blur', async () => {
    playlistsMock = [mk('aa', 'Late Night')];
    renderGallery();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Late Night 이름변경' }));
    const input = screen.getByLabelText('이름 변경') as HTMLInputElement;
    await userEvent.setup().clear(input);
    await userEvent.setup().type(input, 'Blurred');
    input.blur();
    await waitFor(() => expect(renameMock).toHaveBeenCalledWith('aa', 'Blurred'));
  });

  it('P1-B: clicking 복제 calls duplicate(id)', async () => {
    playlistsMock = [mk('aa', 'Late Night')];
    duplicateMock.mockReturnValue(mk('copy', 'Late Night (사본)'));
    renderGallery();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Late Night 복제' }));
    expect(duplicateMock).toHaveBeenCalledWith('aa');
  });

  it('P1-D: shows the backup notice banner when there is at least one playlist', () => {
    playlistsMock = [mk('aa', 'Late Night')];
    renderGallery();
    expect(screen.getByText(/이 기기에만 저장/)).toBeInTheDocument();
  });

  it('P1-D: does NOT show the banner in the empty state', () => {
    playlistsMock = [];
    renderGallery();
    expect(screen.queryByText(/이 기기에만 저장/)).toBeNull();
  });

  it('P1-D: dismissing hides the banner and persists the choice', async () => {
    playlistsMock = [mk('aa', 'Late Night')];
    renderGallery();
    expect(screen.getByText(/이 기기에만 저장/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: '백업 안내 닫기' }));
    expect(screen.queryByText(/이 기기에만 저장/)).toBeNull();
    expect(localStorage.getItem('yejin.backupNoticeDismissed')).toBe('1');
  });

  it('P1-D: stays hidden when already dismissed in localStorage', () => {
    localStorage.setItem('yejin.backupNoticeDismissed', '1');
    playlistsMock = [mk('aa', 'Late Night')];
    renderGallery();
    expect(screen.queryByText(/이 기기에만 저장/)).toBeNull();
  });

  it('renders 내보내기 / 가져오기 backup buttons in the header', () => {
    renderGallery();
    expect(screen.getByRole('button', { name: '내보내기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '가져오기' })).toBeInTheDocument();
  });

  it('clicking 내보내기 calls exportAll', async () => {
    const exportSpy = vi.spyOn(storage, 'exportAll').mockReturnValue('{}');
    // jsdom lacks URL.createObjectURL — stub so the download path doesn't throw
    const createUrl = vi.fn(() => 'blob:x');
    const revokeUrl = vi.fn();
    (URL as any).createObjectURL = createUrl;
    (URL as any).revokeObjectURL = revokeUrl;
    renderGallery();
    await userEvent.setup().click(screen.getByRole('button', { name: '내보내기' }));
    expect(exportSpy).toHaveBeenCalled();
    exportSpy.mockRestore();
  });

  // jsdom's File has no .text() — give the uploaded file one so the import path runs.
  function jsonFile(contents: string): File {
    const file = new File([contents], 'backup.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(contents) });
    return file;
  }

  it('choosing a file calls importAll, then refresh + a confirmation alert', async () => {
    const importSpy = vi
      .spyOn(storage, 'importAll')
      .mockReturnValue({ songs: 3, playlists: 2 });
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderGallery();
    const input = screen.getByLabelText('백업 파일 가져오기') as HTMLInputElement;
    await userEvent.setup().upload(input, jsonFile('{"version":1,"songs":{},"playlists":[]}'));
    await waitFor(() => expect(importSpy).toHaveBeenCalled());
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('가져오기 완료'));
    importSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it('a failing import alerts a friendly message', async () => {
    const importSpy = vi.spyOn(storage, 'importAll').mockImplementation(() => {
      throw new storage.BackupParseError('파일을 읽을 수 없어요.');
    });
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderGallery();
    const input = screen.getByLabelText('백업 파일 가져오기') as HTMLInputElement;
    await userEvent.setup().upload(input, jsonFile('bad'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('파일을 읽을 수 없어요.'));
    importSpy.mockRestore();
    alertSpy.mockRestore();
  });
});
