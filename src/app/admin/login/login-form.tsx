"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useState } from "react";
import { Turnstile } from "@/components/forms/turnstile";
import { loginAction } from "../actions/auth";

export function LoginForm({ siteKey }: { siteKey?: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  const [token, setToken] = useState("");
  return (
    <form action={action} className="mt-6 grid gap-4">
      {state && !state.ok && (
        <p role="alert" className="notice notice-danger">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="email" className="field-label">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" />
      </div>
      <div>
        <label htmlFor="password" className="field-label">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <input type="hidden" name="cf-turnstile-response" value={token} />
      <Turnstile siteKey={siteKey} onToken={setToken} />
      <button className="btn btn-primary" disabled={pending} aria-busy={pending}>
        {pending && <Loader2 size={16} className="animate-spin" aria-hidden />} Sign in
      </button>
    </form>
  );
}
