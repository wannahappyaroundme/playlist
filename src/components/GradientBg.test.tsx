import { describe, it, expect } from 'vitest';
import { StrictMode } from 'react';
import { render } from '@testing-library/react';
import GradientBg from './GradientBg';
import type { SongColors } from '../types';

const A: SongColors = { gradientFrom: '#101030', gradientTo: '#05050f', accent: '#7755ff' };
const B: SongColors = { gradientFrom: '#300a0a', gradientTo: '#0f0505', accent: '#ff5577' };

describe('GradientBg', () => {
  it('renders two crossfade layers', () => {
    const { container } = render(<GradientBg colors={A} />);
    expect(container.querySelectorAll('[data-testid="gradient-layer"]').length).toBe(2);
  });

  it('paints the active layer with the from/to colors', () => {
    const { container } = render(<GradientBg colors={A} />);
    const layers = Array.from(
      container.querySelectorAll('[data-testid="gradient-layer"]')
    ) as HTMLElement[];
    const active = layers.find((l) => l.style.opacity === '1');
    expect(active).toBeTruthy();
    expect(active!.style.backgroundImage.toLowerCase()).toContain('#101030');
    expect(active!.style.backgroundImage.toLowerCase()).toContain('#05050f');
  });

  it('crossfades to the other layer when colors change', () => {
    const { container, rerender } = render(<GradientBg colors={A} />);
    const before = Array.from(
      container.querySelectorAll('[data-testid="gradient-layer"]')
    ) as HTMLElement[];
    const activeIdxBefore = before.findIndex((l) => l.style.opacity === '1');

    rerender(<GradientBg colors={B} />);
    const after = Array.from(
      container.querySelectorAll('[data-testid="gradient-layer"]')
    ) as HTMLElement[];
    const activeIdxAfter = after.findIndex((l) => l.style.opacity === '1');

    expect(activeIdxAfter).not.toBe(activeIdxBefore); // role toggled
    expect(after[activeIdxAfter].style.backgroundImage.toLowerCase()).toContain('#300a0a');
  });

  it('does not toggle the front layer on initial StrictMode double-mount (Fix 19)', () => {
    const { container } = render(
      <StrictMode>
        <GradientBg colors={A} />
      </StrictMode>,
    );
    const layers = Array.from(
      container.querySelectorAll('[data-testid="gradient-layer"]'),
    ) as HTMLElement[];
    // layer 0 stays the visible/front layer (no spurious crossfade toggle)
    expect(layers[0].style.opacity).toBe('1');
    expect(layers[1].style.opacity).toBe('0');
  });
});
