import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Song } from '../types';

// --- mocks (real signatures assumed from contract) ---
const resolveMock = vi.fn();
vi.mock('../hooks/useSongResolver', () => ({
  useSongResolver: () => ({ resolve: resolveMock, resolving: false }),
}));
vi.mock('../lib/youtube', () => ({
  parseVideoId: (input: string) => {
    const m = input.match(/[\w-]{11}/);
    return m ? m[0] : null;
  },
}));

import PasteInput from './PasteInput';

function makeSong(id: string): Song {
  return {
    id,
    title: 't',
    artist: 'a',
    durationSec: 100,
    cover: 'c.jpg',
    colors: { gradientFrom: '#000', gradientTo: '#111', accent: '#222' },
    lyrics: { type: 'none', source: 'none', offsetMs: 0 },
    resolvedAt: '2026-06-20T00:00:00.000Z',
  };
}

describe('PasteInput', () => {
  beforeEach(() => {
    resolveMock.mockReset();
  });

  it('resolves a pasted link and calls onAdd with the resolved song', async () => {
    resolveMock.mockResolvedValue(makeSong('abcDEF12345'));
    const onAdd = vi.fn();
    render(<PasteInput onAdd={onAdd} />);
    await userEvent.type(screen.getByRole('textbox'), 'https://youtu.be/abcDEF12345');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(resolveMock).toHaveBeenCalledWith('abcDEF12345');
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 'abcDEF12345' }));
  });

  it('processes multiple lines, calling onAdd once per valid line', async () => {
    resolveMock
      .mockResolvedValueOnce(makeSong('aaaaaaaaaa1'))
      .mockResolvedValueOnce(makeSong('bbbbbbbbbb2'));
    const onAdd = vi.fn();
    render(<PasteInput onAdd={onAdd} />);
    const box = screen.getByRole('textbox');
    await userEvent.click(box);
    // paste two lines (type with newline)
    await userEvent.paste('https://youtu.be/aaaaaaaaaa1\nhttps://youtu.be/bbbbbbbbbb2');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(2));
  });

  it('shows an error for an unparseable line and does not call onAdd', async () => {
    const onAdd = vi.fn();
    render(<PasteInput onAdd={onAdd} />);
    await userEvent.type(screen.getByRole('textbox'), 'not-a-link');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    await waitFor(() => expect(screen.getByTestId('paste-error')).toBeInTheDocument());
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('shows a per-song error when resolve rejects but keeps processing', async () => {
    resolveMock
      .mockRejectedValueOnce(new Error('embed blocked'))
      .mockResolvedValueOnce(makeSong('bbbbbbbbbb2'));
    const onAdd = vi.fn();
    render(<PasteInput onAdd={onAdd} />);
    const box = screen.getByRole('textbox');
    await userEvent.click(box);
    await userEvent.paste('https://youtu.be/aaaaaaaaaa1\nhttps://youtu.be/bbbbbbbbbb2');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('paste-error')).toBeInTheDocument();
  });
});
