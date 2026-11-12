"use client";

import { useEffect, useRef } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
}

/**
 * A drifting neural field that leans toward the pointer. Pauses off-screen and
 * in hidden tabs, and draws a single still frame under reduced motion.
 */
export default function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let nodes: Node[] = [];
    let frame = 0;
    let visible = true;
    const pointer = { x: -9999, y: -9999 };

    const seed = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(w < 640 ? 34 : 70, Math.floor((w * h) / 15000));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.8,
        hue: Math.random() < 0.5 ? 262 : 189,
      }));
    };

    const draw = () => {
      g.clearRect(0, 0, w, h);
      const max = 150;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < max) {
            g.strokeStyle = `hsla(${(a.hue + b.hue) / 2}, 85%, 68%, ${(1 - d / max) * 0.28})`;
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(a.x, a.y);
            g.lineTo(b.x, b.y);
            g.stroke();
          }
        }
        const dp = Math.hypot(a.x - pointer.x, a.y - pointer.y);
        const near = dp < 190 ? 1 - dp / 190 : 0;
        if (near > 0) {
          g.strokeStyle = `hsla(189, 95%, 65%, ${near * 0.5})`;
          g.beginPath();
          g.moveTo(a.x, a.y);
          g.lineTo(pointer.x, pointer.y);
          g.stroke();
        }
        g.fillStyle = `hsla(${a.hue}, 90%, 72%, ${0.55 + near * 0.45})`;
        g.beginPath();
        g.arc(a.x, a.y, a.r + near * 1.8, 0, Math.PI * 2);
        g.fill();
      }
    };

    const tick = () => {
      if (visible) {
        for (const n of nodes) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > w) n.vx *= -1;
          if (n.y < 0 || n.y > h) n.vy *= -1;
        }
        draw();
      }
      frame = requestAnimationFrame(tick);
    };

    seed();
    draw();
    if (reduce) return;

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
    };
    const onLeave = () => void (pointer.x = pointer.y = -9999);
    const onResize = () => {
      seed();
      draw();
    };
    const onVisibility = () => void (visible = !document.hidden);
    const observer = new IntersectionObserver(([entry]) => void (visible = entry.isIntersecting && !document.hidden));
    observer.observe(canvas);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 h-full w-full" />;
}
