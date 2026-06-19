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
});
