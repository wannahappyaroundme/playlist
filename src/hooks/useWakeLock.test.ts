import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWakeLock } from './useWakeLock';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('useWakeLock', () => {
  let release: ReturnType<typeof vi.fn>;
  let request: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    release = vi.fn().mockResolvedValue(undefined);
    request = vi.fn().mockResolvedValue({ release });
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  });
  afterEach(() => {
    delete (navigator as unknown as { wakeLock?: unknown }).wakeLock;
    vi.restoreAllMocks();
  });

  it('requests a screen wake lock when active', async () => {
    renderHook(() => useWakeLock(true));
    await flush();
    expect(request).toHaveBeenCalledWith('screen');
  });

  it('does not request when inactive', () => {
    renderHook(() => useWakeLock(false));
    expect(request).not.toHaveBeenCalled();
  });

  it('releases the lock on unmount', async () => {
    const { unmount } = renderHook(() => useWakeLock(true));
    await flush();
    unmount();
    expect(release).toHaveBeenCalled();
  });

  it('no-ops (no throw) when navigator.wakeLock is unavailable', () => {
    delete (navigator as unknown as { wakeLock?: unknown }).wakeLock;
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });
});
