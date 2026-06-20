import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LpDisc from './LpDisc';

describe('LpDisc', () => {
  it('renders the cover image (both label and sleeve) with the given src', () => {
    render(<LpDisc cover="https://i.ytimg.com/vi/abc/maxresdefault.jpg" spinning={false} accent="#ff0066" />);
    const imgs = screen.getAllByRole('img');
    expect(imgs.length).toBeGreaterThanOrEqual(1);
    expect(imgs[0]).toHaveAttribute('src', 'https://i.ytimg.com/vi/abc/maxresdefault.jpg');
  });

  it('exposes a data-spinning attribute reflecting the spinning prop', () => {
    const { rerender, container } = render(
      <LpDisc cover="c.jpg" spinning={false} accent="#fff" />
    );
    expect(container.querySelector('[data-testid="lp-vinyl"]')).toHaveAttribute('data-spinning', 'false');
    rerender(<LpDisc cover="c.jpg" spinning={true} accent="#fff" />);
    expect(container.querySelector('[data-testid="lp-vinyl"]')).toHaveAttribute('data-spinning', 'true');
  });

  it('applies the accent color to the glow ring style', () => {
    const { container } = render(<LpDisc cover="c.jpg" spinning accent="#12ab34" />);
    const glow = container.querySelector('[data-testid="lp-glow"]') as HTMLElement;
    expect(glow).toBeTruthy();
    expect(glow.style.cssText.toLowerCase()).toContain('#12ab34');
  });

  it('renders cover and vinyl at the same diameter side by side, wired to --lp-overlap', () => {
    // Spec §7: cover (square) + vinyl (circle) share one diameter, vinyl slid left
    // to overlap by --lp-overlap. Both pieces take width var(--lp-piece) (derived
    // from --lp-overlap), the cover anchored left and the vinyl anchored right.
    const { container } = render(<LpDisc cover="c.jpg" spinning={false} accent="#fff" />);
    const cover = container.querySelector('[data-testid="lp-cover"]') as HTMLElement;
    const vinyl = container.querySelector('[data-testid="lp-vinyl"]') as HTMLElement;
    expect(cover).toBeTruthy();
    expect(vinyl).toBeTruthy();
    // same diameter: both are aspect-square and share the same width var
    expect(cover.className).toContain('aspect-square');
    expect(vinyl.className).toContain('aspect-square');
    expect(cover.style.width).toBe('var(--lp-piece)');
    expect(vinyl.style.width).toBe('var(--lp-piece)');
    // overlap is driven by the --lp-overlap CSS variable on the container
    const root = cover.parentElement as HTMLElement;
    expect(root.style.cssText).toContain('--lp-overlap');
    // cover left, vinyl right (record pulled out toward the right)
    expect(cover.className).toContain('left-0');
    expect(vinyl.className).toContain('right-0');
  });
});
