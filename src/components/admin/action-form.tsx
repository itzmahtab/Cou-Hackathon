"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionResult } from "@/lib/server";
import { cn } from "@/lib/cn";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

/**
 * A form bound to a server action, with pending, success and error states.
 * `confirm` asks before submitting; `confirmPhrase` makes the admin type a word.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  submitClass = "btn-primary",
  confirm,
  confirmPhrase,
  className,
  resetOnSuccess,
  inline,
}: {
  action: Action;
  children?: ReactNode;
  submitLabel: string;
  submitClass?: string;
  confirm?: string;
  confirmPhrase?: string;
  className?: string;
  resetOnSuccess?: boolean;
  inline?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) form.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={form}
      action={formAction}
      className={cn(inline ? "flex flex-wrap items-center gap-2" : "grid gap-4", className)}
      onSubmit={(e) => {
        if (confirmPhrase) {
          const typed = window.prompt(`${confirm ?? "Are you sure?"}\n\nType ${confirmPhrase} to continue.`);
          if (typed !== confirmPhrase) e.preventDefault();
        } else if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <div className={cn("flex flex-wrap items-center gap-3", inline && "contents")}>
        <button className={cn("btn btn-sm", submitClass)} disabled={pending} aria-busy={pending}>
          {pending && <Loader2 size={14} className="animate-spin" aria-hidden />}
          {submitLabel}
        </button>
        {state && !pending && (
          <p role={state.ok ? "status" : "alert"} className={cn("text-sm", state.ok ? "text-success" : "text-danger")}>
            {state.ok ? state.message ?? "Saved." : state.error}
            {!state.ok && state.fields && Object.keys(state.fields).length > 0 && (
              <span className="block text-xs text-danger/90">{Object.entries(state.fields).map(([k, v]) => `${k}: ${v}`).join(" · ")}</span>
            )}
          </p>
        )}
      </div>
    </form>
  );
}
