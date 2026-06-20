import { useEffect, useRef, useState } from 'react';
import type { SongColors } from '../types';

interface GradientBgProps {
  colors: SongColors;
}

function meshFor(c: SongColors): string {
  return [
    `radial-gradient(120% 90% at 20% 15%, ${c.gradientFrom} 0%, transparent 55%)`,
    `radial-gradient(110% 80% at 85% 25%, ${c.accent} 0%, transparent 45%)`,
    `radial-gradient(140% 120% at 50% 100%, ${c.gradientTo} 0%, transparent 70%)`,
    `linear-gradient(180deg, ${c.gradientFrom}, ${c.gradientTo})`,
  ].join(',');
}

export default function GradientBg({ colors }: GradientBgProps) {
  // two layers; `front` is which index currently holds the visible color
  const [layers, setLayers] = useState<[SongColors, SongColors]>([colors, colors]);
  const [front, setFront] = useState(0);
  const frontRef = useRef(0);
  // Compare against the previous colors value instead of a one-shot "initial"
  // flag. A StrictMode double-mount re-runs the effect with the same colors, so
  // the equality guard returns early both times — no spurious crossfade toggle.
  const prevColorsRef = useRef(colors);

  useEffect(() => {
    if (prevColorsRef.current === colors) return;
    prevColorsRef.current = colors;
    // paint the new colors onto the back layer, then make it the front.
    // refs (not stale state) drive the toggle so the update is computed once.
    const back = frontRef.current === 0 ? 1 : 0;
    frontRef.current = back;
    setLayers((prev) => {
      const nxt: [SongColors, SongColors] = [prev[0], prev[1]];
      nxt[back] = colors;
      return nxt;
    });
    setFront(back);
  }, [colors]);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-black" aria-hidden="true">
      {[0, 1].map((i) => (
        <div
          key={i}
          data-testid="gradient-layer"
          className="absolute inset-0 transition-opacity duration-[1200ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{
            backgroundImage: meshFor(layers[i]),
            opacity: i === front ? 1 : 0,
            willChange: 'opacity',
          }}
        />
      ))}
      {/* readability darkening + conservative blur veil */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[3px]" />
    </div>
  );
}
