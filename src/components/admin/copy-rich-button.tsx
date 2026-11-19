"use client";

import { Check, ClipboardCopy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Copies formatted HTML (with a plain-text fallback) so it can be pasted into a
 * Gmail or Outlook compose window with its banner, buttons and links intact.
 */
export function CopyRichButton({ html, text, label = "Copy formatted email", className, primary = false }: { html: string; text: string; label?: string; className?: string; primary?: boolean }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) throw new Error("no rich clipboard");
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]);
    } catch {
      // Older browsers: select a rendered copy and use the legacy copy command, which keeps formatting.
      const box = document.createElement("div");
      box.innerHTML = html;
      box.style.position = "fixed";
      box.style.left = "-10000px";
      document.body.appendChild(box);
      const range = document.createRange();
      range.selectNodeContents(box);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      document.execCommand("copy");
      sel?.removeAllRanges();
      box.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  }
  return (
    <button type="button" onClick={copy} className={cn("btn btn-sm", primary ? "btn-primary" : "btn-secondary", className)} aria-live="polite">
      {done ? <Check size={14} aria-hidden /> : <ClipboardCopy size={14} aria-hidden />}
      {done ? "Copied — paste into the email" : label}
    </button>
  );
}
