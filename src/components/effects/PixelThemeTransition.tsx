"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTheme } from "next-themes";

interface PixelTransitionContextType {
  togglePixelTheme: (e?: React.MouseEvent | { clientX: number; clientY: number }) => void;
  setThemeWithPixelTransition: (
    targetTheme: string,
    e?: React.MouseEvent | { clientX: number; clientY: number }
  ) => void;
  isTransitioning: boolean;
}

const PixelTransitionContext = createContext<PixelTransitionContextType>({
  togglePixelTheme: () => { },
  setThemeWithPixelTransition: () => { },
  isTransitioning: false,
});

export const usePixelThemeTransition = () => useContext(PixelTransitionContext);

interface PixelThemeTransitionProviderProps {
  children: React.ReactNode;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  maxLife: number;
  life: number;
}

export function PixelThemeTransitionProvider({
  children,
}: PixelThemeTransitionProviderProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const currentTheme = theme || resolvedTheme || "dark";

  const runPixelAnimation = useCallback(
    (targetTheme: string, originX: number, originY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        setTheme(targetTheme);
        return;
      }

      const ctx = canvas.getContext("2d", { alpha: true });
      if (!ctx) {
        setTheme(targetTheme);
        return;
      }

      // Check for prefers-reduced-motion
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        setTheme(targetTheme);
        return;
      }

      setIsTransitioning(true);
      if (typeof document !== "undefined") {
        document.documentElement.classList.add("pixel-theme-transitioning");
      }

      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.imageSmoothingEnabled = false;
      ctx.scale(dpr, dpr);

      // Sizing for authentic retro pixel aesthetic that fits the UI grid
      const pixelSize = Math.max(16, Math.min(22, Math.floor(width / 55)));
      const cols = Math.ceil(width / pixelSize) + 1;
      const rows = Math.ceil(height / pixelSize) + 1;

      // Distance from origin to farthest corner
      const corners = [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: 0, y: height },
        { x: width, y: height },
      ];
      const maxDistance = Math.max(
        ...corners.map((c) => Math.hypot(c.x - originX, c.y - originY))
      );

      const isGoingDark = targetTheme === "dark";

      // Palette accurately sampled from Agent Studio's actual theme surfaces and brand tokens
      const palette = isGoingDark
        ? [
          "#000000", // Obsidian (UI dark background)
          "#050711", // Deep dark
          "#0a0f24", // Midnight terminal surface
          "#0f172a", // Slate 900
          "#1e1b4b", // Indigo 950 (card border)
          "#2e2a72", // Subtle dark indigo
          "#3730a3", // Brand primary indigo muted
        ]
        : [
          "#ffffff", // Clean white (UI light card surface)
          "#f8fafc", // Slate 50 (UI light background)
          "#f1f5f9", // Slate 100
          "#e2e8f0", // Slate 200 (UI light border)
          "#e0e7ff", // Indigo 100 (subtle brand tint)
          "#c7d2fe", // Indigo 200
          "#cbd5e1", // Slate 300
        ];

      const leadBorderColor = isGoingDark ? "#4f46e5" : "#818cf8";

      // Precompute grid cells with jittered delay and transparent alpha
      interface GridCell {
        c: number;
        r: number;
        x: number;
        y: number;
        dist: number;
        normDist: number;
        randomOffset: number;
        colorIndex: number;
        baseAlpha: number;
      }

      const grid: GridCell[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = c * pixelSize + pixelSize / 2;
          const cy = r * pixelSize + pixelSize / 2;
          const dist = Math.hypot(cx - originX, cy - originY);
          const normDist = dist / maxDistance;
          // Organic 8-bit dithered edge offset
          const randomOffset = (Math.random() - 0.5) * 0.12;
          const colorIndex = Math.floor(Math.random() * palette.length);
          // Whisper-light translucent alpha (0.06 to 0.18) for an ultra-smooth glassy blend
          const baseAlpha = 0.06 + Math.random() * 0.12;

          grid.push({
            c,
            r,
            x: c * pixelSize,
            y: r * pixelSize,
            dist,
            normDist,
            randomOffset,
            colorIndex,
            baseAlpha,
          });
        }
      }

      // Sparkle micro-pixels matching brand colors
      const particles: Particle[] = [];
      const particleColors = isGoingDark
        ? ["#4f46e5", "#6366f1", "#818cf8", "#312e81", "#1e1b4b"]
        : ["#6366f1", "#818cf8", "#a5b4fc", "#cbd5e1", "#e2e8f0"];

      for (let i = 0; i < 16; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.0 + Math.random() * 2.2;
        particles.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.floor(Math.random() * 2 + 2) * 2, // 4px or 6px
          color: particleColors[Math.floor(Math.random() * particleColors.length)],
          alpha: 0.25,
          maxLife: 70 + Math.random() * 45,
          life: 0,
        });
      }

      // Smooth transition duration (3000ms)
      const duration = 3000;
      const startTime = performance.now();
      let themeSwitched = false;

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const rawProgress = Math.min(elapsed / duration, 1);

        // Switch underlying theme at wave midpoint (~48%)
        if (!themeSwitched && rawProgress >= 0.48) {
          setTheme(targetTheme);
          themeSwitched = true;
        }

        ctx.clearRect(0, 0, width, height);

        // Wave dynamics:
        // Expansion phase (0 -> 0.48): sweeping outward from origin across screen
        // Dissolve phase (0.42 -> 1.0): clean pixel dissolve to reveal new theme
        const waveFront = rawProgress < 0.48
          ? (rawProgress / 0.48) * 1.15
          : 1.15;
        const fadeFront = rawProgress >= 0.42
          ? ((rawProgress - 0.42) / 0.58) * 1.25
          : 0;

        // Layer 1: Ambient Radial Color Wave Wash (Smooth expanding ambient tone)
        const currentRadius = Math.max(0, waveFront * maxDistance);
        const innerRadius = Math.max(0, fadeFront * maxDistance);

        if (currentRadius > 0) {
          const gradient = ctx.createRadialGradient(
            originX,
            originY,
            innerRadius,
            originX,
            originY,
            currentRadius + pixelSize * 2
          );
          const washColor = isGoingDark ? "10, 15, 36" : "241, 245, 249";
          const washAlpha = Math.min(0.20, (1 - fadeFront / 1.25) * 0.20);

          gradient.addColorStop(0, `rgba(${washColor}, ${fadeFront > 0 ? 0 : washAlpha})`);
          gradient.addColorStop(0.65, `rgba(${washColor}, ${washAlpha})`);
          gradient.addColorStop(1, `rgba(${washColor}, 0)`);

          ctx.globalAlpha = 1;
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(originX, originY, currentRadius + pixelSize * 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Layer 2: Render Pixel Grid on top of ambient wash
        for (let i = 0; i < grid.length; i++) {
          const cell = grid[i];
          const cellPos = cell.normDist + cell.randomOffset;

          if (cellPos <= waveFront) {
            const enterProgress = Math.min(Math.max((waveFront - cellPos) * 3.5, 0), 1);
            let exitProgress = 0;
            if (fadeFront > 0 && cellPos <= fadeFront) {
              exitProgress = Math.min(Math.max((fadeFront - cellPos) * 2.8, 0), 1);
            }

            const visible = enterProgress > 0 && exitProgress < 1;

            if (visible) {
              const alpha = cell.baseAlpha * enterProgress * Math.max(0, 1 - exitProgress);
              const scale = enterProgress * (1 - exitProgress * 0.25);

              const w = pixelSize * scale;
              const h = pixelSize * scale;
              const offsetX = cell.x + (pixelSize - w) / 2;
              const offsetY = cell.y + (pixelSize - h) / 2;

              ctx.globalAlpha = alpha;

              // Fill with theme-consistent translucent color
              const baseColor = palette[cell.colorIndex];
              ctx.fillStyle = baseColor;
              ctx.fillRect(Math.floor(offsetX), Math.floor(offsetY), Math.ceil(w), Math.ceil(h));

              // Subtle 1px retro highlight border on the leading wave edge for depth
              if (enterProgress < 0.95 && alpha > 0.03) {
                ctx.globalAlpha = Math.min(0.18, alpha * 1.5);
                ctx.fillStyle = leadBorderColor;
                ctx.fillRect(Math.floor(offsetX), Math.floor(offsetY), Math.ceil(w), 1);
                ctx.fillRect(Math.floor(offsetX), Math.floor(offsetY), 1, Math.ceil(h));
              }
            }
          }
        }

        // Layer 3: Render subtle accent particles
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life++;

          const pProgress = p.life / p.maxLife;
          if (pProgress < 1) {
            const pAlpha = (1 - pProgress) * Math.min(1, (1 - rawProgress) * 1.5) * p.alpha;
            ctx.globalAlpha = Math.max(0, pAlpha);
            ctx.fillStyle = p.color;
            ctx.fillRect(
              Math.floor(p.x),
              Math.floor(p.y),
              p.size,
              p.size
            );
          }
        }

        if (rawProgress < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          ctx.clearRect(0, 0, width, height);
          setIsTransitioning(false);
          if (typeof document !== "undefined") {
            document.documentElement.classList.remove("pixel-theme-transitioning");
          }
          if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
          }
        }
      };

      animFrameRef.current = requestAnimationFrame(animate);
    },
    [setTheme]
  );

  const setThemeWithPixelTransition = useCallback(
    (
      targetTheme: string,
      e?: React.MouseEvent | { clientX: number; clientY: number }
    ) => {
      if (isTransitioning) return;

      let x = typeof window !== "undefined" ? window.innerWidth / 2 : 0;
      let y = typeof window !== "undefined" ? 64 : 0;

      if (e) {
        if ("currentTarget" in e && e.currentTarget instanceof HTMLElement) {
          if (e.clientX !== 0 || e.clientY !== 0) {
            x = e.clientX;
            y = e.clientY;
          } else {
            const rect = e.currentTarget.getBoundingClientRect();
            x = rect.left + rect.width / 2;
            y = rect.top + rect.height / 2;
          }
        } else if ("clientX" in e && "clientY" in e) {
          x = e.clientX;
          y = e.clientY;
        }
      }

      runPixelAnimation(targetTheme, x, y);
    },
    [isTransitioning, runPixelAnimation]
  );

  const togglePixelTheme = useCallback(
    (e?: React.MouseEvent | { clientX: number; clientY: number }) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      setThemeWithPixelTransition(nextTheme, e);
    },
    [currentTheme, setThemeWithPixelTransition]
  );

  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return (
    <PixelTransitionContext.Provider
      value={{
        togglePixelTheme,
        setThemeWithPixelTransition,
        isTransitioning,
      }}
    >
      {children}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`fixed inset-0 pointer-events-none z-[99999] ${isTransitioning ? "block" : "hidden"
          }`}
      />
    </PixelTransitionContext.Provider>
  );
}
