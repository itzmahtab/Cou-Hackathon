import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";

const PATHS = ["", "/about", "/challenges", "/rules", "/register", "/payment", "/schedule", "/prizes", "/faq", "/contact", "/leaderboard", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((p) => ({ url: `${SITE.url}${p}`, changeFrequency: "daily", priority: p === "" ? 1 : p === "/register" ? 0.9 : 0.6 }));
}
