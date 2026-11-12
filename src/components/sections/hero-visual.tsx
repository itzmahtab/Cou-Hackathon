"use client";

import dynamic from "next/dynamic";

// The canvas is decorative, so it loads after first paint and never blocks the headline.
const HeroCanvas = dynamic(() => import("./hero-canvas"), { ssr: false });

export function HeroVisual() {
  return <HeroCanvas />;
}
