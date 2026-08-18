"use client";

import React, { useEffect, useRef } from "react";

const CELL = 18;
const GAP = 2;

// Seconds each pattern plays before crossfading into the next
const PATTERN_DURATION = 7;
// Per-pattern hue offset (degrees): indigo, cyan, violet, blue
const PATTERN_HUES = [0, -18, 14, -30];

/**
 * LED-matrix style pixel wave for the hero background.
 *
 * A grid of small sharp squares lights up in flowing patterns that keep
 * evolving — expanding radial ripples, drifting diagonal bars, a rotating
 * spiral vortex, and a radiating checkerboard pulse — with smooth crossfades
 * between each pattern and a subtle hue shift per pattern. Echoes the app's
 * pixel (Silkscreen) font and dot-grid background while staying subtle behind
 * content. Drawn on canvas for performance.
 */
export function PixelGridWave({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let raf = 0;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    const smoothstep = (a: number, b: number, x: number) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };

    /** Returns a wave value in roughly [-1, 1] for the given pattern. */
    const patternValue = (x: number, y: number, t: number, p: number) => {
      switch (p % 4) {
        case 0: {
          // Expanding radial ripples from a slowly traveling source
          const cx = width * (0.5 + 0.38 * Math.sin(t * 0.28));
          const cy = height * (0.42 + 0.3 * Math.sin(t * 0.45 + 1.4));
          const d = Math.hypot(x - cx, y - cy);
          return Math.sin(d * 0.05 - t * 3.2);
        }
        case 1: {
          // Diagonal bars drifting across
          return Math.sin((x + y) * 0.03 - t * 3.0);
        }
        case 2: {
          // Rotating spiral vortex around a drifting center
          const cx = width * (0.5 + 0.25 * Math.sin(t * 0.24));
          const cy = height * (0.45 + 0.2 * Math.sin(t * 0.3 + 2));
          const dx = x - cx;
          const dy = y - cy;
          const ang = Math.atan2(dy, dx);
          const d = Math.hypot(dx, dy);
          return Math.sin(ang * 3 + d * 0.045 - t * 2.4);
        }
        default: {
          // Checkerboard pulse radiating from a moving source
          const cx = width * (0.5 + 0.3 * Math.sin(t * 0.2));
          const cy = height * (0.45 + 0.25 * Math.cos(t * 0.22 + 1));
          const d = Math.hypot(x - cx, y - cy);
          const checker = Math.sin(x * 0.1) * Math.sin(y * 0.1);
          return checker * 0.55 + Math.sin(d * 0.04 - t * 2.8) * 0.55;
        }
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * DPR));
      canvas.height = Math.max(1, Math.floor(height * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cols = Math.ceil(width / CELL) + 1;
      rows = Math.ceil(height / CELL) + 1;
      if (prefersReducedMotion) {
        draw(6500); // redraw a static frame so the canvas isn't blank after resize
      }
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      const t = time / 1000;

      // Pattern scheduling with smooth crossfade near the end of each cycle
      const cycle = t / PATTERN_DURATION;
      const from = Math.floor(cycle) % 4;
      const to = (from + 1) % 4;
      const progress = cycle - Math.floor(cycle);
      const blend = smoothstep(0.75, 1, progress);
      const hueFrom = PATTERN_HUES[from];
      const hueTo = PATTERN_HUES[to];

      for (let row = 0; row < rows; row++) {
        const y = row * CELL;
        for (let col = 0; col < cols; col++) {
          const x = col * CELL;

          const vA = patternValue(x, y, t, from);
          const vB = patternValue(x, y, t, to);
          const v = (1 - blend) * vA + blend * vB + 1; // ~0..2
          const a = Math.max(0, Math.min(1, (v - 1.32) * 2.4));
          if (a <= 0.02) continue;

          // indigo → cyan, with a per-pattern hue offset for variety
          const isDark = typeof document !== "undefined" && !document.documentElement.classList.contains("light");
          const hue = 226 + (1 - blend) * hueFrom + blend * hueTo - a * 26;
          const fillAlpha = isDark ? a * 0.10 : a * 0.28;
          const lightness = isDark ? 58 + a * 20 : 40 + a * 18;
          ctx.fillStyle = `hsla(${hue}, ${isDark ? 90 : 88}%, ${lightness}%, ${fillAlpha})`;
          ctx.fillRect(x + GAP / 2, y + GAP / 2, CELL - GAP, CELL - GAP);
        }
      }

      if (!prefersReducedMotion) {
        raf = requestAnimationFrame(draw);
      }
    };

    resize();
    draw(prefersReducedMotion ? 6500 : performance.now());

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full [mask-image:radial-gradient(ellipse_100%_85%_at_50%_40%,black_40%,transparent_98%)] ${className}`}
    />
  );
}
