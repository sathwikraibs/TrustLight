// Temporary: walks through the install flow on a phone-sized browser and screenshots each step.
import http from "node:http";
import { readFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { createRequire } from "node:module";
const { chromium, devices } = createRequire(process.env.PW_DIR + "/")("playwright");
const dist = "dist", out = "../../install-shots"; mkdirSync(out, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json" };
const srv = http.createServer((req, res) => { let p = join(dist, decodeURIComponent(req.url.split("?")[0])); if (!existsSync(p) || statSync(p).isDirectory()) p = join(dist, "index.html"); res.writeHead(200, { "Content-Type": types[extname(p)] || "application/octet-stream" }); res.end(readFileSync(p)); }).listen(4174);
const b = await chromium.launch();
const log = [];
for (const lang of ["en", "tcy"]) {
  const ctx = await b.newContext({ ...devices["Pixel 7"] });
  await ctx.addInitScript((l) => { try { sessionStorage.setItem("tl-intro", "1"); localStorage.setItem("staysafe.lang.v1", l); localStorage.setItem("staysafe.language", l); } catch {} }, lang);
  await ctx.route(/onrender\.com|fonts\.g/, (r) => r.abort());
  const pg = await ctx.newPage();
  pg.on("pageerror", (e) => log.push(`${lang} pageerror: ${e.message}`));
  await pg.goto("http://127.0.0.1:4174/");
  await pg.waitForTimeout(1200);
  // Chrome offers installing
  await pg.evaluate(() => { const e = new Event("beforeinstallprompt"); e.prompt = async () => {}; e.userChoice = new Promise((r) => setTimeout(() => r({ outcome: "accepted" }), 300)); window.dispatchEvent(e); });
  await pg.waitForTimeout(500);
  const card = pg.locator("text=/Add to my phone|ಇನ್‌ಸ್ಟಾಲ್ ಮಲ್ಪುಲೆ/").first();
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await pg.screenshot({ path: `${out}/${lang}-1-offer.png` });
  const btn = pg.locator("button", { hasText: /Add to my phone|ಎನ್ನ ಫೋನ್‌ಗ್/ }).first();
  log.push(`${lang} install button visible: ${await btn.isVisible()}`);
  await btn.click(); await btn.click().catch(() => {});      // double tap
  await pg.waitForTimeout(900);
  await pg.screenshot({ path: `${out}/${lang}-2-installing.png` });
  log.push(`${lang} install buttons after tap: ${await pg.locator("button", { hasText: /Add to my phone|ಎನ್ನ ಫೋನ್‌ಗ್/ }).count()}`);
  // reload while installing: progress should still show
  await pg.reload(); await pg.waitForTimeout(1200);
  log.push(`${lang} still installing after reload: ${await pg.locator(".install-bar").count() > 0}`);
  await pg.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await pg.waitForTimeout(600);
  await pg.screenshot({ path: `${out}/${lang}-3-installed.png` });
  log.push(`${lang} open button: ${await pg.locator("button", { hasText: /Open TrustLight app|ಆ್ಯಪ್ ತೆರೆಲೆ/ }).count()}`);
  await ctx.close();
}
// iPhone: no install offer -> steps
const ctx = await b.newContext({ ...devices["iPhone 15"] });
await ctx.addInitScript(() => { try { sessionStorage.setItem("tl-intro", "1"); } catch {} });
await ctx.route(/onrender\.com|fonts\.g/, (r) => r.abort());
const pg = await ctx.newPage(); pg.on("pageerror", (e) => log.push(`ios pageerror: ${e.message}`));
await pg.goto("http://127.0.0.1:4174/"); await pg.waitForTimeout(1200);
await pg.locator("text=Add to Home Screen").first().scrollIntoViewIfNeeded().catch(() => {});
await pg.screenshot({ path: `${out}/ios-steps.png` });
log.push(`ios steps shown: ${await pg.locator("text=Add to Home Screen").count()}`);
await b.close(); srv.close();
console.log(log.join("\n"));
for (const l of log) console.log(`::warning::${l}`);
