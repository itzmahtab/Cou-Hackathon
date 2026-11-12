"use client";

import { useSyncExternalStore } from "react";

const parts = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
};

function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}

/** Counts down to the hackathon. Renders a stable placeholder on the server to avoid a hydration mismatch. */
export function Countdown({ target, label = "Hackathon starts in" }: { target: string; label?: string }) {
  const end = Date.parse(target);
  // null on the server and during hydration, so the markup matches; then ticks every second.
  const now = useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 1000) * 1000, () => null);

  const left = now === null ? null : end - now;
  const p = left === null ? null : parts(left);
  const cells: [string, number | null][] = [
    ["Days", p?.days ?? null],
    ["Hours", p?.hours ?? null],
    ["Minutes", p?.minutes ?? null],
    ["Seconds", p?.seconds ?? null],
  ];
  if (left !== null && left <= 0) {
    return <p className="font-mono text-sm uppercase tracking-[0.18em] text-secondary">The hackathon is under way</p>;
  }
  return (
    <div role="timer" aria-label={p ? `${label}: ${p.days} days, ${p.hours} hours, ${p.minutes} minutes` : label}>
      <p className="eyebrow mb-3 text-muted">{label}</p>
      <div className="flex gap-2 sm:gap-3" aria-hidden="true">
        {cells.map(([name, value]) => (
          <div key={name} className="glass min-w-[4.25rem] rounded-2xl px-3 py-3 text-center sm:min-w-[5.5rem] sm:px-4 sm:py-4">
            <div className="font-mono text-2xl font-semibold tabular-nums text-fg sm:text-4xl">{value === null ? "--" : String(value).padStart(2, "0")}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted sm:text-xs">{name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
