export const SITE = {
  name: "CoU AI Hackathon 2026",
  title: "CoU AI Hackathon 2026 | Build Beyond Imagination",
  description:
    "Join CoU AI Hackathon 2026 at Comilla University on 24 November. Showcase your AI innovation, compete with talented students, and win from a BDT 25,000 prize pool.",
  tagline: "Five Hours. One Vision. Infinite Possibilities.",
  // Canonical origin for metadata. Set NEXT_PUBLIC_SITE_URL at build time for the real domain.
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  parent: "CoU Technova 2026",
  organiser: "Faculty of Engineering, Comilla University",
};

export const NAV = [
  { href: "/about", label: "About" },
  { href: "/challenges", label: "Challenges" },
  { href: "/schedule", label: "Schedule" },
  { href: "/prizes", label: "Prizes" },
  { href: "/rules", label: "Rules" },
  { href: "/faq", label: "FAQ" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/showcase", label: "Showcase" },
];

export const FOOTER_NAV = [
  { href: "/register", label: "Register" },
  { href: "/status", label: "Registration status" },
  { href: "/payment", label: "Payment instructions" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms" },
];
