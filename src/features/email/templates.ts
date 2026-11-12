export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface Layout {
  subject: string;
  heading: string;
  greeting?: string;
  paragraphs: string[];
  facts?: [string, string][];
  cta?: { label: string; url: string };
  footnote?: string;
}

export const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const EVENT = "CoU AI Hackathon 2026";

function layout(l: Layout): RenderedEmail {
  const e = escapeHtml;
  const facts = l.facts?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border:1px solid #e5e7eb;border-radius:8px">${l.facts
        .map(
          ([k, v]) =>
            `<tr><td style="padding:10px 14px;color:#64748b;font-size:13px;width:38%;border-bottom:1px solid #f1f5f9">${e(k)}</td><td style="padding:10px 14px;color:#0f172a;font-size:14px;font-weight:600;border-bottom:1px solid #f1f5f9">${e(v)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const cta = l.cta
    ? `<p style="margin:28px 0"><a href="${e(l.cta.url)}" style="background:#7c3aed;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:600;display:inline-block">${e(l.cta.label)}</a></p><p style="font-size:12px;color:#64748b;word-break:break-all">If the button does not work, open: ${e(l.cta.url)}</p>`
    : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(l.subject)}</title></head>
<body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#070812;padding:26px 28px"><div style="color:#a78bfa;font-size:12px;letter-spacing:2px;text-transform:uppercase">Comilla University · Faculty of Engineering</div><div style="color:#f8fafc;font-size:22px;font-weight:700;margin-top:6px">${EVENT}</div></td></tr>
<tr><td style="padding:28px;color:#0f172a;font-size:15px;line-height:1.65">
<h1 style="font-size:22px;margin:0 0 16px;color:#0f172a">${e(l.heading)}</h1>
${l.greeting ? `<p style="margin:0 0 14px">${e(l.greeting)}</p>` : ""}
${l.paragraphs.map((p) => `<p style="margin:0 0 14px">${e(p)}</p>`).join("")}
${facts}${cta}
${l.footnote ? `<p style="margin:18px 0 0;color:#64748b;font-size:13px">${e(l.footnote)}</p>` : ""}
</td></tr>
<tr><td style="background:#f8fafc;padding:18px 28px;color:#64748b;font-size:12px;line-height:1.6">${EVENT} · 24 November 2026 · Comilla University, Bangladesh<br>Five Hours. One Vision. Infinite Possibilities.<br>You are receiving this because your team registered for the hackathon.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    EVENT,
    "",
    l.heading,
    "",
    l.greeting ?? "",
    ...l.paragraphs,
    "",
    ...(l.facts ?? []).map(([k, v]) => `${k}: ${v}`),
    "",
    l.cta ? `${l.cta.label}: ${l.cta.url}` : "",
    l.footnote ?? "",
    "",
    "24 November 2026 · Comilla University, Bangladesh",
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");
  return { subject: l.subject, html, text };
}

type P = Record<string, unknown>;
const s = (v: unknown) => String(v ?? "");

export const TEMPLATES = {
  registration_confirmation: (p: P) =>
    layout({
      subject: `Registration received: ${s(p.teamName)} (${s(p.registrationId)})`,
      heading: "Your idea is in.",
      greeting: `Hi ${s(p.name)},`,
      paragraphs: [
        `Team ${s(p.teamName)} is registered for Phase 1 of ${EVENT}. Phase 1 is free; there is nothing to pay now.`,
        `Our reviewers will score every idea. The 30 selected teams will be announced by email on ${s(p.announcement)}, with payment instructions for Phase 2.`,
        "Keep your registration ID safe. You will need it to check your status.",
      ],
      facts: [
        ["Registration ID", s(p.registrationId)],
        ["Team", s(p.teamName)],
        ["Members", (p.members as string[]).join(", ")],
        ["Idea", s(p.ideaTitle)],
        ["Hackathon day", s(p.eventDate)],
        ["Venue", s(p.venue)],
      ],
      cta: { label: "Check registration status", url: s(p.statusUrl) },
      footnote: "This link is personal to you. Do not forward it.",
    }),

  shortlisted: (p: P) =>
    layout({
      subject: `You are shortlisted: ${s(p.teamName)} is in the top 30`,
      heading: "Congratulations. You are in.",
      greeting: `Hi ${s(p.name)},`,
      paragraphs: [
        `Team ${s(p.teamName)} has been selected for the on-site round of ${EVENT}.`,
        `To confirm your place, send the team fee of BDT ${s(p.feeBdt)} by bKash or Nagad Send Money and submit the transaction ID on the website before ${s(p.deadline)}. The fee is per team, not per person.`,
        "An organiser checks every transaction by hand. You will get another email when yours is verified.",
      ],
      facts: [
        ["Registration ID", s(p.registrationId)],
        ["Team fee", `BDT ${s(p.feeBdt)}`],
        ["bKash (Send Money)", s(p.bkash) || "See the payment page"],
        ["Nagad (Send Money)", s(p.nagad) || "See the payment page"],
        ["Payment deadline", s(p.deadline)],
        ["Hackathon day", s(p.eventDate)],
        ["Venue", s(p.venue)],
      ],
      cta: { label: "Submit payment details", url: s(p.statusUrl) },
      footnote: "Only send money to the numbers shown on the official website.",
    }),

  not_selected: (p: P) =>
    layout({
      subject: `${EVENT}: selection result for ${s(p.teamName)}`,
      heading: "Thank you for your idea.",
      greeting: `Hi ${s(p.name)},`,
      paragraphs: [
        `We received far more strong ideas than the 30 places available, and team ${s(p.teamName)} was not selected for the on-site round this time.`,
        "This is not a verdict on your idea. We hope you keep building it, and that we see you at the next event.",
      ],
      facts: [["Registration ID", s(p.registrationId)]],
    }),

  payment_received: (p: P) =>
    layout({
      subject: `Payment details received: ${s(p.teamName)}`,
      heading: "We have your payment details.",
      greeting: `Hi ${s(p.name)},`,
      paragraphs: ["An organiser will now check the transaction against the payment statement. This is done by hand and can take up to a day."],
      facts: [
        ["Registration ID", s(p.registrationId)],
        ["Method", s(p.provider)],
        ["Transaction ID", s(p.transactionId)],
        ["Amount", `BDT ${s(p.amountBdt)}`],
      ],
      cta: { label: "View status", url: s(p.statusUrl) },
    }),

  payment_verified: (p: P) =>
    layout({
      subject: `Confirmed: ${s(p.teamName)} is going to ${EVENT}`,
      heading: "Your place is confirmed.",
      greeting: `Hi ${s(p.name)},`,
      paragraphs: [
        `Payment verified. Team ${s(p.teamName)} is confirmed for the hackathon.`,
        "Bring your student ID card and a charged laptop. Open the link below at the check-in desk to show your team pass.",
      ],
      facts: [
        ["Registration ID", s(p.registrationId)],
        ["Hackathon day", s(p.eventDate)],
        ["Venue", s(p.venue)],
      ],
      cta: { label: "Open team pass", url: s(p.statusUrl) },
    }),

  payment_rejected: (p: P) =>
    layout({
      subject: `Action needed: payment for ${s(p.teamName)} could not be verified`,
      heading: "We could not verify your payment.",
      greeting: `Hi ${s(p.name)},`,
      paragraphs: [
        `Reason given by the organiser: ${s(p.reason)}`,
        p.canResubmit
          ? `You can submit corrected details before ${s(p.deadline)}.`
          : "Resubmission is currently closed. Please contact the organisers.",
      ],
      facts: [
        ["Registration ID", s(p.registrationId)],
        ["Transaction ID", s(p.transactionId)],
      ],
      cta: { label: "Review and resubmit", url: s(p.statusUrl) },
    }),

  announcement: (p: P) =>
    layout({
      subject: s(p.subject),
      heading: s(p.subject),
      greeting: p.name ? `Hi ${s(p.name)},` : undefined,
      paragraphs: s(p.body)
        .split(/\n{2,}/)
        .map((x) => x.trim())
        .filter(Boolean),
      cta: p.statusUrl ? { label: "View your status", url: s(p.statusUrl) } : undefined,
    }),

  results: (p: P) =>
    layout({
      subject: `${EVENT}: final results are published`,
      heading: "The results are in.",
      greeting: `Hi ${s(p.name)},`,
      paragraphs: [`Thank you for five hours of building. The final leaderboard for ${EVENT} is now public.`],
      cta: { label: "See the leaderboard", url: s(p.leaderboardUrl) },
    }),

  status_otp: (p: P) =>
    layout({
      subject: `Your ${EVENT} verification code: ${s(p.code)}`,
      heading: "Your verification code",
      paragraphs: [`Enter this code on the status page: ${s(p.code)}`, "It expires in 10 minutes. If you did not ask for it, ignore this email."],
    }),

  admin_payment_notice: (p: P) =>
    layout({
      subject: `New payment to verify: ${s(p.teamName)}`,
      heading: "A payment is waiting for verification.",
      paragraphs: ["A shortlisted team has submitted payment details."],
      facts: [
        ["Team", s(p.teamName)],
        ["Registration ID", s(p.registrationId)],
        ["Method", s(p.provider)],
        ["Transaction ID", s(p.transactionId)],
      ],
      cta: { label: "Open payment verification", url: s(p.url) },
    }),
} satisfies Record<string, (p: P) => RenderedEmail>;

export type TemplateName = keyof typeof TEMPLATES;

export const TEMPLATE_LABELS: Record<TemplateName, string> = {
  registration_confirmation: "Registration confirmation",
  shortlisted: "Shortlisted",
  not_selected: "Not selected",
  payment_received: "Payment received",
  payment_verified: "Payment verified",
  payment_rejected: "Payment rejected",
  announcement: "Announcement",
  results: "Final results",
  status_otp: "Status code",
  admin_payment_notice: "Admin: payment notice",
};

export function renderEmail(template: string, payload: P): RenderedEmail {
  const fn = (TEMPLATES as Record<string, (p: P) => RenderedEmail>)[template];
  if (!fn) throw new Error(`Unknown email template: ${template}`);
  return fn(payload);
}
