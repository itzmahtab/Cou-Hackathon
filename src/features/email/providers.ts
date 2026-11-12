import type { RuntimeEnv } from "@/lib/ctx";
import type { RenderedEmail } from "./templates";

export interface EmailProvider {
  send(to: string, email: RenderedEmail): Promise<{ messageId: string | null }>;
  /** Checks the connection and login without sending anything. */
  verify?(): Promise<void>;
  /** Releases any open connection at the end of a batch. */
  close?(): void;
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
    case "smtp": {
      // Nodemailer over SMTP (Gmail: smtp.gmail.com, port 465, an App Password).
      // Workers provide node:net and node:tls through nodejs_compat, which Nodemailer uses.
      if (!env.SMTP_USER || !env.SMTP_PASSWORD) throw new Error("SMTP_USER or SMTP_PASSWORD is not set.");
      const port = Number(env.SMTP_PORT ?? 465);
      let transport: import("nodemailer").Transporter | null = null;
      const get = async () => {
        if (!transport) {
          const nodemailer = (await import("nodemailer")).default;
          transport = nodemailer.createTransport({
            host: env.SMTP_HOST ?? "smtp.gmail.com",
            port,
            secure: port === 465,
            auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
            // One connection reused for the whole batch, closed by close().
            pool: true,
            maxConnections: 1,
            // os.hostname() is not meaningful in a Worker; name the client explicitly.
            name: "cou-hackathon.workers.dev",
            connectionTimeout: 15_000,
            greetingTimeout: 15_000,
            socketTimeout: 30_000,
          });
        }
        return transport;
      };
      return {
        async send(to, email) {
          const info = await (await get()).sendMail({ from: env.EMAIL_FROM, to, replyTo: replyTo, subject: email.subject, html: email.html, text: email.text });
          return { messageId: info.messageId ?? null };
        },
        async verify() {
          await (await get()).verify();
        },
        close() {
          transport?.close();
          transport = null;
        },
      };
    }
    case "test-fail":
      // Test-only provider whose sends always fail, to exercise retries.
      if (env.APP_ENV !== "test") throw new Error("test-fail is only for tests.");
      return {
        async send() {
          throw new Error("simulated provider outage");
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
