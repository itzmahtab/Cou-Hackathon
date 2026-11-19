"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

/** Copies `text` to the clipboard, with a fallback for browsers that block the async API. */
export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  }
  return (
    <button type="button" onClick={copy} className={cn("btn btn-secondary btn-sm", className)} aria-live="polite">
      {done ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      {done ? "Copied" : label}
    </button>
  );
}
