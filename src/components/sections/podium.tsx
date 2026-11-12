"use client";

import { Crown, Medal, Trophy } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import type { PublicRow } from "@/features/results/service";
import { cn } from "@/lib/cn";

const META = {
  CHAMPION: { label: "Champion", icon: Crown, color: "text-gold", border: "border-gold/50", height: "md:h-72", order: "md:order-2", glow: "shadow-[0_0_80px_-20px] shadow-gold/60" },
  FIRST_RUNNER_UP: { label: "First Runner-up", icon: Trophy, color: "text-silver", border: "border-silver/40", height: "md:h-56", order: "md:order-1", glow: "" },
  SECOND_RUNNER_UP: { label: "Second Runner-up", icon: Medal, color: "text-bronze", border: "border-bronze/50", height: "md:h-48", order: "md:order-3", glow: "" },
} as const;

export function Podium({ rows }: { rows: PublicRow[] }) {
  const reduce = useReducedMotion();
  const top = (["CHAMPION", "FIRST_RUNNER_UP", "SECOND_RUNNER_UP"] as const).map((p) => rows.find((r) => r.position === p)).filter((r): r is PublicRow => !!r);

  useEffect(() => {
    if (reduce || top.length === 0) return;
    let cancelled = false;
    const t = setTimeout(() => {
      void import("canvas-confetti").then(({ default: confetti }) => {
        if (cancelled) return;
        confetti({ particleCount: 140, spread: 80, origin: { y: 0.35 }, colors: ["#8b5cf6", "#22d3ee", "#facc15", "#f8fafc"], disableForReducedMotion: true });
      });
    }, 900);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [reduce, top.length]);

  return (
    <ol className="grid items-end gap-4 md:grid-cols-3" aria-label="Winners">
      {top.map((row, i) => {
        const m = META[row.position!];
        return (
          <motion.li
            key={row.position}
            className={cn(m.order)}
            initial={reduce ? false : { opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: reduce ? 0 : [0.5, 0.25, 0.75][i] ?? 0, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={cn("card glow-card is-lit flex flex-col justify-end p-7 text-center", m.border, m.height, m.glow)}>
              <m.icon size={36} className={cn("mx-auto", m.color)} aria-hidden />
              <p className={cn("mt-4 text-xs font-semibold uppercase tracking-[0.18em]", m.color)}>{m.label}</p>
              <p className="mt-2 text-xl font-semibold">{row.teamName}</p>
              <p className="mt-1 text-sm text-muted">{row.projectTitle}</p>
              <p className="mt-1 text-xs text-muted">{row.universities.join(" · ")}</p>
              <p className="mt-4 font-mono text-sm">
                {row.totalScore} pts · <span className={m.color}>BDT {row.prizeBdt?.toLocaleString("en-US")}</span>
              </p>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
