"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Turnstile } from "@/components/forms/turnstile";
import { loginAction } from "../actions/auth";

export function LoginForm({ siteKey }: { siteKey?: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  const [token, setToken] = useState("");
  const router = useRouter();
  const signedIn = state?.ok === true;
  // The dashboard loads in its own request, not inside the sign-in request.
  useEffect(() => {
    if (signedIn) router.replace("/admin");
  }, [signedIn, router]);
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
      <button className="btn btn-primary" disabled={pending || signedIn} aria-busy={pending || signedIn}>
        {(pending || signedIn) && <Loader2 size={16} className="animate-spin" aria-hidden />} Sign in
      </button>
    </form>
  );
}
