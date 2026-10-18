// Temporary: screenshots of every page from a built site folder, for comparing before/after an upgrade.
// node scripts/shots.mjs <distDir> <outDir> [intro]
import http from "node:http";
import { readFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { createRequire } from "node:module";
const { chromium } = createRequire(process.env.PW_DIR + "/")("playwright");
const [dist, out, intro] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };
const srv = http.createServer((req, res) => {
  let p = join(dist, decodeURIComponent(req.url.split("?")[0]));
  if (!existsSync(p) || statSync(p).isDirectory()) p = join(dist, "index.html");
  res.writeHead(200, { "Content-Type": types[extname(p)] || "application/octet-stream" });
  res.end(readFileSync(p));
}).listen(4173);
const pages = ["/", "/scan-url", "/scan-message", "/scan-qr", "/scan-file", "/scan-email", "/check-number", "/check-password", "/check-network", "/dashboard", "/incident", "/scam-library", "/help", "/settings", "/about"];
const browser = await chromium.launch();
for (const [name, vp] of [["m", { width: 390, height: 844 }], ["d", { width: 1280, height: 860 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("tl-intro", "1"); } catch {} });
  await ctx.route(/onrender\.com|fonts\.g/, (r) => r.abort());
  const pg = await ctx.newPage();
  for (const p of pages) {
    await pg.goto("http://127.0.0.1:4173" + p, { waitUntil: "networkidle" }).catch(() => {});
    await pg.waitForTimeout(1200);
    await pg.screenshot({ path: `${out}/${name}${p === "/" ? "-home" : p.replace(/\//g, "-")}.png`, fullPage: true });
  }
  await ctx.close();
}
if (intro) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 } });
  await ctx.route(/onrender\.com|fonts\.g/, (r) => r.abort());
  const pg = await ctx.newPage();
  await pg.goto("http://127.0.0.1:4173/");
  for (const t of [700, 1700, 2600]) { await pg.waitForTimeout(t === 700 ? 700 : 950); await pg.screenshot({ path: `${out}/intro-${t}.png` }); }
  await ctx.close();
}
await browser.close(); srv.close();
