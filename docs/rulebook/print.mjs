// Prints rulebook.html to a 720 x 405 pt PDF with Chromium, then renders previews.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");
const dir = fileURLToPath(new URL(".", import.meta.url));
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(`file://${dir}rulebook.html`);
await p.evaluate(() => document.fonts.ready);
const fonts = await p.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family));
await p.pdf({ path: `${dir}CoU_AI_Hackathon_2026_Rulebook_Revised.pdf`, width: "960px", height: "540px", printBackground: true, preferCSSPageSize: true });
console.log("pdf written; web fonts loaded:", fonts.length ? fonts.join(", ") : "none (system Carlito/Caladea used)");
await b.close();
