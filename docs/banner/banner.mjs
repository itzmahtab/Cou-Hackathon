// Renders the CoU Technova 2026 social media banners with Chromium.
//   node docs/banner/banner.mjs
// Writes square (1080 x 1080, Facebook/Instagram feed) and wide (1920 x 1080, cover/event)
// PNGs at 2x into docs/banner/. Content and dates are below; edit and re-run.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const root = fileURLToPath(new URL("../../", import.meta.url));
const out = fileURLToPath(new URL(".", import.meta.url));
const b64 = (p) => readFileSync(root + p).toString("base64");
const font = (w) => `url(data:font/woff2;base64,${b64(`node_modules/geist/dist/fonts/geist-sans/Geist-${w}.woff2`)}) format("woff2")`;
const mono = `url(data:font/woff2;base64,${b64("node_modules/geist/dist/fonts/geist-mono/GeistMono-Medium.woff2")}) format("woff2")`;
const img = (p, t) => `data:${t};base64,${b64(p)}`;
const CREST = img("public/sponsors/varsity_logo.jpeg", "image/jpeg");
const AORUS = img("public/sponsors/Gigabyte_aorus_logos_dark_bg.png", "image/png");
const ITP = img("public/sponsors/ITP-2.png", "image/png");

// A fixed, hand-placed constellation so the art is identical on every render.
const NODES = [[6, 14], [15, 6], [24, 18], [34, 9], [46, 4], [58, 12], [69, 7], [81, 15], [92, 6], [96, 24], [88, 33], [76, 26], [64, 22], [52, 28], [40, 24], [28, 31], [16, 27], [4, 36], [10, 52], [22, 61], [8, 74], [18, 86], [32, 93], [48, 88], [62, 95], [76, 89], [90, 92], [95, 76], [86, 66], [94, 52]];
const LINKS = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [15, 16], [16, 17], [17, 18], [18, 19], [19, 20], [20, 21], [21, 22], [22, 23], [23, 24], [24, 25], [25, 26], [26, 27], [27, 28], [28, 29], [29, 9], [2, 15], [5, 13], [11, 7], [19, 16], [24, 26]];
const net = (w, h) => {
  const p = ([x, y]) => [(x / 100) * w, (y / 100) * h];
  const lines = LINKS.map(([a, c]) => {
    const [x1, y1] = p(NODES[a]);
    const [x2, y2] = p(NODES[c]);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join("");
  const dots = NODES.map((n, i) => {
    const [x, y] = p(n);
    return `<circle cx="${x}" cy="${y}" r="${i % 3 ? 2.4 : 3.6}" fill="${i % 2 ? "#a78bfa" : "#22d3ee"}"/>`;
  }).join("");
  return `<svg class="net" viewBox="0 0 ${w} ${h}" aria-hidden="true"><g stroke="rgba(167,139,250,.22)" stroke-width="1.2">${lines}</g>${dots}</svg>`;
};

const css = (w, h) => `
@font-face { font-family: Geist; font-weight: 400; src: ${font("Regular")}; }
@font-face { font-family: Geist; font-weight: 500; src: ${font("Medium")}; }
@font-face { font-family: Geist; font-weight: 600; src: ${font("SemiBold")}; }
@font-face { font-family: Geist; font-weight: 700; src: ${font("Bold")}; }
@font-face { font-family: Geist; font-weight: 800; src: ${font("Black")}; }
@font-face { font-family: GeistMono; font-weight: 500; src: ${mono}; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${w}px; height: ${h}px; }
body { background: #100e0b; color: #f8fafc; font-family: Geist, sans-serif; overflow: hidden; position: relative; -webkit-font-smoothing: antialiased; }
.grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px); background-size: 54px 54px; mask-image: radial-gradient(ellipse 85% 75% at 50% 40%, #000 35%, transparent 80%); }
.l1, .l2, .l3 { position: absolute; inset: 0; pointer-events: none; }
.l1 { background: radial-gradient(ellipse 120% 145% at 50% -50%, rgba(0,0,0,0) 58%, rgb(240,240,245) 76%, rgba(0,0,0,0) 84%); mix-blend-mode: screen; filter: blur(90px); opacity: .5; }
.l2 { background: radial-gradient(ellipse 120% 145% at 50% -50%, rgba(0,0,0,0) 50%, rgba(121,42,242,0.35) 78%, rgba(0,0,0,0) 100%); mix-blend-mode: screen; filter: blur(240px); }
.l3 { background: radial-gradient(ellipse 120% 145% at 50% -50%, rgba(0,0,0,0) 82.5%, #ff007a 83.5%, rgba(0,0,0,0) 84.5%); mix-blend-mode: lighten; filter: blur(43px); opacity: .75; }
.glow-b { position: absolute; width: 60%; height: 50%; left: 20%; bottom: -25%; background: radial-gradient(closest-side, rgba(6,182,212,.22), transparent); filter: blur(40px); }
.net { position: absolute; inset: 0; width: 100%; height: 100%; }
.content { position: relative; z-index: 1; height: 100%; }
.mono { font-family: GeistMono, monospace; letter-spacing: .16em; text-transform: uppercase; }
.grad { background: linear-gradient(120deg, #c4b5fd 0%, #8b5cf6 35%, #22d3ee 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.crest { border-radius: 50%; background: #fff; padding: 6px; box-shadow: 0 0 0 1px rgba(255,255,255,.25), 0 10px 40px rgba(139,92,246,.35); }
.card { position: relative; border-radius: 26px; background: rgba(24,22,26,.82); border: 1px solid rgba(255,255,255,.12); box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 20px 60px rgba(0,0,0,.45); }
.card::before { content: ""; position: absolute; inset: -1px; border-radius: inherit; padding: 1.5px; background: linear-gradient(140deg, rgba(139,92,246,.9), rgba(34,211,238,.6) 45%, transparent 70%); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
.card.alt::before { background: linear-gradient(140deg, rgba(250,204,21,.85), rgba(244,114,182,.55) 45%, transparent 70%); }
.tag { display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; padding: 7px 14px; font-weight: 600; }
.tag.v { background: rgba(139,92,246,.18); color: #c4b5fd; border: 1px solid rgba(139,92,246,.45); }
.tag.y { background: rgba(250,204,21,.14); color: #fde68a; border: 1px solid rgba(250,204,21,.45); }
.row { display: flex; justify-content: space-between; gap: 16px; padding: 11px 0; border-top: 1px solid rgba(255,255,255,.08); }
.row span:first-child { color: #a1a1aa; }
.row span:last-child { font-weight: 600; text-align: right; }
.big { font-weight: 800; letter-spacing: -.02em; }
.pill { display: inline-flex; align-items: center; gap: 14px; border-radius: 999px; background: #7c3aed; box-shadow: 0 0 0 1px rgba(167,139,250,.5), 0 12px 50px -8px rgba(139,92,246,.9); font-weight: 700; }
.sp { display: flex; align-items: center; justify-content: center; gap: 26px; }
.sp .lbl { color: #a1a1aa; }
.itp { background: #fff; border-radius: 10px; padding: 8px 12px; display: inline-flex; }
`;

const hackathon = (fs) => `
  <div class="tag v" style="font-size:${fs.tag}px">⚡ OPEN TO ALL UNIVERSITIES</div>
  <h2 class="big" style="font-size:${fs.h}px;margin-top:${fs.gap}px">AI Hackathon</h2>
  <p style="color:#d4d4d8;font-size:${fs.p}px;margin-top:6px">Five hours. One vision. Infinite possibilities.</p>
  <div style="margin-top:${fs.gap}px;font-size:${fs.row}px">
    <div class="row"><span>Prize pool</span><span class="grad" style="font-size:${fs.row + 6}px;font-weight:800">BDT 25,000</span></div>
    <div class="row"><span>Team</span><span>1 – 3 members</span></div>
    <div class="row"><span>Free pre-registration</span><span>12 – 18 Nov</span></div>
    <div class="row"><span>Pre-build (Top 30)</span><span>21 – 23 Nov</span></div>
    <div class="row"><span>On-site final</span><span>24 Nov · 5 hours</span></div>
  </div>`;

const showcase = (fs) => `
  <div class="tag y" style="font-size:${fs.tag}px">🎓 COMILLA UNIVERSITY STUDENTS</div>
  <h2 class="big" style="font-size:${fs.h}px;margin-top:${fs.gap}px">Project Showcase</h2>
  <p style="color:#d4d4d8;font-size:${fs.p}px;margin-top:6px">Showcase your ideas. Inspire innovation.</p>
  <div style="margin-top:${fs.gap}px;font-size:${fs.row}px">
    <div class="row"><span>Fee</span><span style="color:#fde68a;font-size:${fs.row + 6}px;font-weight:800">BDT 50 / person</span></div>
    <div class="row"><span>Team</span><span>Up to 4 members</span></div>
    <div class="row"><span>Registration</span><span>13 – 22 Nov</span></div>
    <div class="row"><span>Showcase day</span><span>23 Nov</span></div>
    <div class="row"><span>Rewards</span><span>E-certificate · Gifts for top 3</span></div>
  </div>`;

const square = `<!doctype html><html><head><meta charset="utf-8"><style>${css(1080, 1080)}</style></head><body>
<div class="grid"></div><div class="l1"></div><div class="l2"></div><div class="l3"></div><div class="glow-b"></div>${net(1080, 1080)}
<div class="content" style="padding:58px 60px 46px;display:flex;flex-direction:column">
  <div style="display:flex;align-items:center;gap:18px">
    <img class="crest" src="${CREST}" style="width:82px;height:82px">
    <div>
      <p class="mono" style="font-size:15px;color:#c4b5fd">Faculty of Engineering presents</p>
      <p style="font-size:21px;font-weight:600;margin-top:4px">Comilla University</p>
    </div>
  </div>
  <h1 class="big" style="font-size:104px;line-height:.95;margin-top:34px">CoU <span class="grad">TECHNOVA</span> 2026</h1>
  <p class="mono" style="font-size:22px;margin-top:16px;color:#e4e4e7">AI &amp; Technology Carnival</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:38px">
    <div class="card" style="padding:26px 24px">${hackathon({ tag: 13, h: 38, p: 16, row: 17, gap: 14 })}</div>
    <div class="card alt" style="padding:26px 24px">${showcase({ tag: 13, h: 38, p: 16, row: 17, gap: 14 })}</div>
  </div>
  <div style="margin-top:auto;display:flex;align-items:center;justify-content:space-between">
    <div class="pill" style="font-size:30px;padding:16px 30px">Register now <span style="opacity:.9">→</span> coutechnova.xyz</div>
    <div style="text-align:right">
      <p class="mono" style="font-size:12px;color:#a1a1aa">Venue</p>
      <p style="font-size:20px;font-weight:700;margin-top:4px">Comilla University</p>
    </div>
  </div>
  <div class="sp" style="margin-top:26px">
    <span class="lbl mono" style="font-size:12px">Title sponsor</span><img src="${AORUS}" style="height:40px;border-radius:8px">
    <span style="width:1px;height:34px;background:rgba(255,255,255,.18)"></span>
    <span class="lbl mono" style="font-size:12px">Powered by</span><span class="itp"><img src="${ITP}" style="height:28px"></span>
  </div>
</div></body></html>`;

const wide = `<!doctype html><html><head><meta charset="utf-8"><style>${css(1920, 1080)}</style></head><body>
<div class="grid"></div><div class="l1"></div><div class="l2"></div><div class="l3"></div><div class="glow-b"></div>${net(1920, 1080)}
<div class="content" style="padding:64px 96px 56px;display:grid;grid-template-columns:1.05fr 1fr;gap:64px;align-items:center">
  <div>
    <div style="display:flex;align-items:center;gap:22px">
      <img class="crest" src="${CREST}" style="width:104px;height:104px">
      <div>
        <p class="mono" style="font-size:19px;color:#c4b5fd">Faculty of Engineering presents</p>
        <p style="font-size:27px;font-weight:600;margin-top:6px">Comilla University</p>
      </div>
    </div>
    <h1 class="big" style="font-size:132px;line-height:.92;margin-top:36px">CoU<br><span class="grad">TECHNOVA</span><br>2026</h1>
    <p class="mono" style="font-size:30px;margin-top:26px;color:#e4e4e7">AI &amp; Technology Carnival</p>
    <div class="pill" style="font-size:36px;padding:20px 36px;margin-top:40px">Register now <span style="opacity:.9">→</span> coutechnova.xyz</div>
    <p style="font-size:24px;color:#d4d4d8;margin-top:24px">Comilla University, Bangladesh</p>
    <div class="sp" style="justify-content:flex-start;margin-top:34px">
      <span class="lbl mono" style="font-size:14px">Title sponsor</span><img src="${AORUS}" style="height:48px;border-radius:10px">
      <span style="width:1px;height:40px;background:rgba(255,255,255,.18)"></span>
      <span class="lbl mono" style="font-size:14px">Powered by</span><span class="itp"><img src="${ITP}" style="height:32px"></span>
    </div>
  </div>
  <div style="display:grid;gap:24px">
    <div class="card" style="padding:26px 32px">${hackathon({ tag: 15, h: 44, p: 19, row: 20, gap: 10 })}</div>
    <div class="card alt" style="padding:26px 32px">${showcase({ tag: 15, h: 44, p: 19, row: 20, gap: 10 })}</div>
  </div>
</div></body></html>`;

const b = await chromium.launch();
for (const [name, html, w, h] of [["CoU_Technova_2026_banner_square", square, 1080, 1080], ["CoU_Technova_2026_banner_wide", wide, 1920, 1080]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await p.setContent(html, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `${out}${name}.png` });
  const overflow = await p.evaluate(() => [...document.querySelectorAll(".content *")].filter((el) => { const r = el.getBoundingClientRect(); return r.right > innerWidth + 1 || r.bottom > innerHeight + 1; }).length);
  console.log(`${name}.png written (${w * 2} x ${h * 2}); elements outside the canvas: ${overflow}`);
}
await b.close();
