import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// vi.mock is hoisted above module-scope consts, so build the spy with
// vi.hoisted() to keep the reference valid inside the (also hoisted) factory.
const { toDataURLMock } = vi.hoisted(() => ({ toDataURLMock: vi.fn() }));
vi.mock('qrcode', () => ({
  default: { toDataURL: toDataURLMock },
}));

import QrShare from './QrShare';

describe('QrShare', () => {
  beforeEach(() => {
    toDataURLMock.mockReset();
    toDataURLMock.mockResolvedValue('data:image/png;base64,FAKE');
  });

  it('renders a QR image generated from the url', async () => {
    render(<QrShare url="https://example.com/#/s/abc" />);
    await waitFor(() => {
      expect(toDataURLMock).toHaveBeenCalledWith('https://example.com/#/s/abc', expect.any(Object));
    });
    const img = await screen.findByAltText(/qr/i);
    expect(img).toHaveAttribute('src', 'data:image/png;base64,FAKE');
  });

  it('regenerates the QR when the url changes', async () => {
    const { rerender } = render(<QrShare url="https://a.com/#/s/1" />);
    await waitFor(() =>
      expect(toDataURLMock).toHaveBeenCalledWith('https://a.com/#/s/1', expect.any(Object))
    );
    rerender(<QrShare url="https://a.com/#/s/2" />);
    await waitFor(() =>
      expect(toDataURLMock).toHaveBeenCalledWith('https://a.com/#/s/2', expect.any(Object))
    );
  });

  it('calls navigator.share with the url when share is available and clicked', async () => {
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    (navigator as unknown as { share: unknown }).share = shareSpy;
    render(<QrShare url="https://example.com/#/s/abc" />);
    await userEvent.click(await screen.findByRole('button', { name: /share|공유/i }));
    expect(shareSpy).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.com/#/s/abc' }));
    delete (navigator as unknown as { share?: unknown }).share;
  });

  it('falls back to clipboard copy when navigator.share is missing', async () => {
    delete (navigator as unknown as { share?: unknown }).share;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<QrShare url="https://example.com/#/s/abc" />);
    await userEvent.click(await screen.findByRole('button', { name: /share|공유|복사/i }));
    expect(writeText).toHaveBeenCalledWith('https://example.com/#/s/abc');
  });
});
