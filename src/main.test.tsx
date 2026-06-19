import { describe, it, expect, vi, beforeEach } from 'vitest';

const renderSpy = vi.fn();
const createRootSpy = vi.fn((_container?: unknown) => ({ render: renderSpy, unmount: vi.fn() }));

vi.mock('react-dom/client', () => ({
  createRoot: createRootSpy,
  default: { createRoot: createRootSpy },
}));
vi.mock('./App', () => ({ default: () => null }));
vi.mock('./index.css', () => ({}));

describe('main entry', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    const el = document.createElement('div');
    el.id = 'root';
    document.body.appendChild(el);
    renderSpy.mockClear();
    createRootSpy.mockClear();
    vi.resetModules();
  });

  it('creates a root on #root and renders App', async () => {
    await import('./main');
    expect(createRootSpy).toHaveBeenCalledTimes(1);
    expect(createRootSpy.mock.calls[0][0]).toBe(document.getElementById('root'));
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });
});
