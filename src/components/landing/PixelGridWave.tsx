"use client";

import React, { useEffect, useRef } from "react";

/**
 * LED-matrix style pixel wave for the hero background.
 *
 * A grid of small sharp squares lights up in flowing ripples that travel from
 * a slowly moving source point — echoing the app's pixel (Silkscreen) font and
 * dot-grid background. Squares (not dots) keep it visually distinct from a
 * generic particle effect. Drawn on canvas for performance.
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

    const CELL = 14;
    const GAP = 2;
    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let raf = 0;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);

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

      // Ripple source travels a slow figure-eight path across the hero
      const cx = width * (0.5 + 0.38 * Math.sin(t * 0.28));
      const cy = height * (0.42 + 0.3 * Math.sin(t * 0.45 + 1.4));

      for (let row = 0; row < rows; row++) {
        const y = row * CELL;
        for (let col = 0; col < cols; col++) {
          const x = col * CELL;

          // Radial ripple expanding from the moving source
          const d = Math.hypot(x - cx, y - cy);
          const ripple = Math.sin(d * 0.05 - t * 3.2);
          // Subtle diagonal sweep for extra motion
          const sweep = Math.sin((x + y) * 0.016 + t * 1.3) * 0.45;

          const v = ripple + sweep + 1; // ~0..2
          const a = Math.max(0, Math.min(1, (v - 1.32) * 2.4));
          if (a <= 0.02) continue;

          // indigo → cyan as cells light up brighter
          const hue = 226 - a * 26;
          ctx.fillStyle = `hsla(${hue}, 90%, ${58 + a * 20}%, ${a * 0.42})`;
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
      className={`pointer-events-none absolute inset-0 h-full w-full [mask-image:radial-gradient(ellipse_75%_75%_at_50%_40%,black_35%,transparent_92%)] ${className}`}
    />
  );
}
