import type { RuntimeEnv } from "@/lib/ctx";
import type { RenderedEmail } from "./templates";

export interface EmailProvider {
  send(to: string, email: RenderedEmail): Promise<{ messageId: string | null }>;
}

function parseFrom(from: string): { name: string; email: string } {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  return m ? { name: m[1] || "CoU AI Hackathon", email: m[2] } : { name: "CoU AI Hackathon", email: from.trim() };
}

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`Email provider responded ${res.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Test and local sink. Records what would have been sent. */
export const sentLog: { to: string; subject: string; text: string }[] = [];

export function getProvider(env: RuntimeEnv): EmailProvider {
  const from = parseFrom(env.EMAIL_FROM);
  const replyTo = env.EMAIL_REPLY_TO || undefined;
  switch (env.EMAIL_PROVIDER) {
    case "brevo":
      if (!env.EMAIL_API_KEY) throw new Error("EMAIL_API_KEY is not set.");
      return {
        async send(to, email) {
          const data = await post(
            "https://api.brevo.com/v3/smtp/email",
            { "api-key": env.EMAIL_API_KEY!, accept: "application/json" },
            {
              sender: from,
              to: [{ email: to }],
              subject: email.subject,
              htmlContent: email.html,
              textContent: email.text,
              ...(replyTo ? { replyTo: { email: replyTo } } : {}),
            },
          );
          return { messageId: typeof data.messageId === "string" ? data.messageId : null };
        },
      };
    case "resend":
      if (!env.EMAIL_API_KEY) throw new Error("EMAIL_API_KEY is not set.");
      return {
        async send(to, email) {
          const data = await post(
            "https://api.resend.com/emails",
            { authorization: `Bearer ${env.EMAIL_API_KEY}` },
            { from: env.EMAIL_FROM, to: [to], subject: email.subject, html: email.html, text: email.text, ...(replyTo ? { reply_to: replyTo } : {}) },
          );
          return { messageId: typeof data.id === "string" ? data.id : null };
        },
      };
    case "log":
      // Never pretend to deliver in production: the row stays queued and the error is visible to admins.
      if (env.APP_ENV === "production") throw new Error("No email provider is configured (EMAIL_PROVIDER=log).");
      return {
        async send(to, email) {
          sentLog.push({ to, subject: email.subject, text: email.text });
          console.log(`[email:log] to=${to} subject=${email.subject}`);
          return { messageId: null };
        },
      };
    default:
      throw new Error(`Unknown EMAIL_PROVIDER: ${env.EMAIL_PROVIDER}`);
  }
}
