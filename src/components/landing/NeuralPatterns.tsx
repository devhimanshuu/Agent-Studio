"use client";

import React, { useEffect, useRef } from "react";

/**
 * NeuralPatterns — AI & agent-themed canvas animations for the hero section.
 *
 * Three autonomous layers rendered on one canvas:
 * 1. Neural pulses: bright nodes pulse with a faint glow, connected by
 *    ephemeral data-flow lines that fade in and out.
 * 2. Floating data particles: small dots that drift upwards like tokenized
 *    thought, with occasional trails.
 * 3. Graph-edge arcs: sweeping bezier curves that echo the agent graph's
 *    conditional edges — appearing and disappearing like routing decisions.
 *
 * All layers are extremely subtle (≤ 8% opacity) so they never compete with
 * content, and they respect prefers-reduced-motion.
 */
export function NeuralPatterns({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let raf = 0;

    // ── Neural Nodes ──────────────────────────────────────────────
    const NODE_COUNT = 14;
    const nodes: { x: number; y: number; pulseSpeed: number; phase: number; connections: number[] }[] = [];

    // ── Data Particles ────────────────────────────────────────────
    const PARTICLE_COUNT = 30;
    const particles: {
      x: number; y: number; vx: number; vy: number;
      life: number; maxLife: number; size: number; trail: { x: number; y: number }[];
    }[] = [];

    // ── Graph Arcs ────────────────────────────────────────────────
    const ARC_COUNT = 6;
    const arcs: {
      startIdx: number; endIdx: number;
      phase: number; speed: number; life: number;
    }[] = [];

    const init = () => {
      nodes.length = 0;
      const margin = 80;
      for (let i = 0; i < NODE_COUNT; i++) {
        nodes.push({
          x: margin + Math.random() * (width - margin * 2),
          y: margin + Math.random() * (height - margin * 2),
          pulseSpeed: 0.4 + Math.random() * 0.8,
          phase: Math.random() * Math.PI * 2,
          connections: [],
        });
      }
      // Build random connections
      for (let i = 0; i < NODE_COUNT; i++) {
        const count = 1 + Math.floor(Math.random() * 3);
        for (let j = 0; j < count; j++) {
          const target = Math.floor(Math.random() * NODE_COUNT);
          if (target !== i && !nodes[i].connections.includes(target)) {
            nodes[i].connections.push(target);
          }
        }
      }

      particles.length = 0;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(createParticle());
      }

      arcs.length = 0;
      for (let i = 0; i < ARC_COUNT; i++) {
        arcs.push({
          startIdx: Math.floor(Math.random() * NODE_COUNT),
          endIdx: Math.floor(Math.random() * NODE_COUNT),
          phase: Math.random() * Math.PI * 2,
          speed: 0.3 + Math.random() * 0.5,
          life: Math.random(),
        });
      }
    };

    const createParticle = () => ({
      x: Math.random() * width,
      y: height + 20 + Math.random() * 40,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(0.4 + Math.random() * 0.8),
      life: 0,
      maxLife: 300 + Math.random() * 400,
      size: 1 + Math.random() * 1.5,
      trail: [] as { x: number; y: number }[],
    });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * DPR));
      canvas.height = Math.max(1, Math.floor(height * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      init();
      if (prefersReducedMotion) draw(6500);
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      const t = time / 1000;

      const isDark = typeof document !== "undefined" && !document.documentElement.classList.contains("light");

      // ── Layer 1: Neural connections ──────────────────────────────
      for (const node of nodes) {
        const pulse = 0.5 + 0.5 * Math.sin(t * node.pulseSpeed + node.phase);
        const alpha = (0.035 + pulse * 0.045) * (isDark ? 1 : 3.0);

        // Draw connections
        for (const targetIdx of node.connections) {
          const target = nodes[targetIdx];
          if (!target) continue;

          const dx = target.x - node.x;
          const dy = target.y - node.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 400) continue;

          const connAlpha = alpha * (1 - dist / 400) * 0.7;
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);

          // Bezier curve for organic feel
          const cpx = (node.x + target.x) / 2 + (Math.random() - 0.5) * 60;
          const cpy = (node.y + target.y) / 2 + (Math.random() - 0.5) * 60;
          ctx.quadraticCurveTo(cpx, cpy, target.x, target.y);
          ctx.strokeStyle = `hsla(226, 85%, ${isDark ? 70 : 40}%, ${connAlpha})`;
          ctx.lineWidth = 0.6 + pulse * 0.6;
          ctx.stroke();
        }

        // Draw node glow
        const glowAlpha = (0.03 + pulse * 0.05) * (isDark ? 1 : 2.4);
        const gradient = ctx.createRadialGradient(
          node.x, node.y, 0,
          node.x, node.y, 14 + pulse * 8
        );
        gradient.addColorStop(0, `hsla(226, 90%, ${isDark ? 80 : 45}%, ${glowAlpha})`);
        gradient.addColorStop(0.5, `hsla(226, 85%, ${isDark ? 60 : 35}%, ${glowAlpha * 0.5})`);
        gradient.addColorStop(1, `hsla(226, 85%, 60%, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 14 + pulse * 8, 0, Math.PI * 2);
        ctx.fill();

        // Draw node dot
        ctx.fillStyle = `hsla(226, 90%, ${isDark ? 80 : 35}%, ${(0.04 + pulse * 0.06) * (isDark ? 1 : 2.8)})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 1.8 + pulse * 1, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Layer 2: Floating data particles ────────────────────────
      for (const p of particles) {
        p.life++;
        p.x += p.vx + Math.sin(t * 0.5 + p.y * 0.01) * 0.2;
        p.y += p.vy;

        // Trail
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 8) p.trail.shift();

        const lifeRatio = p.life / p.maxLife;
        const fadeIn = Math.min(1, lifeRatio * 4);
        const fadeOut = Math.max(0, 1 - (lifeRatio - 0.6) / 0.4);
        const alpha = fadeIn * fadeOut * (isDark ? 0.08 : 0.26);

        // Draw trail
        if (p.trail.length > 1) {
          for (let i = 1; i < p.trail.length; i++) {
            const trailAlpha = (i / p.trail.length) * alpha * 0.6;
            ctx.beginPath();
            ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
            ctx.lineTo(p.trail[i].x, p.trail[i].y);
            ctx.strokeStyle = `hsla(180, 75%, ${isDark ? 70 : 35}%, ${trailAlpha})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }

        // Draw particle
        ctx.fillStyle = `hsla(180, 85%, ${isDark ? 80 : 35}%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Reset
        if (p.life > p.maxLife || p.y < -20) {
          Object.assign(p, createParticle());
          p.y = height + 20;
        }
      }

      // ── Layer 3: Graph edge arcs ────────────────────────────────
      for (const arc of arcs) {
        arc.life += 0.005;
        if (arc.life > 1) {
          arc.life = 0;
          arc.startIdx = Math.floor(Math.random() * NODE_COUNT);
          arc.endIdx = Math.floor(Math.random() * NODE_COUNT);
        }

        const start = nodes[arc.startIdx];
        const end = nodes[arc.endIdx];
        if (!start || !end) continue;

        const dist = Math.hypot(end.x - start.x, end.y - start.y);
        if (dist > 400) continue;

        const arcAlpha = Math.sin(arc.life * Math.PI) * (isDark ? 0.06 : 0.22);
        if (arcAlpha <= 0.01) continue;

        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2 + Math.sin(t * arc.speed + arc.phase) * 30;

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.quadraticCurveTo(midX, midY, end.x, end.y);
        ctx.strokeStyle = `hsla(260, 70%, ${isDark ? 70 : 40}%, ${arcAlpha})`;
        ctx.lineWidth = 1.0;
        ctx.setLineDash([4, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
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
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}