// Checks the built page against the site's security policy (CSP in vercel.json), which blocks any
// CSS or script written inside the page. Such code would silently not run on the live site
// (for example the opening animation would sit on the page as a big picture), so the build fails instead.
// Run after `npm run build`: node scripts/check-page.mjs
import { readFileSync, existsSync } from "node:fs";

const html = readFileSync("dist/index.html", "utf8");
const csp = JSON.parse(readFileSync("vercel.json", "utf8")).headers
  .flatMap((r) => r.headers).find((h) => h.key === "Content-Security-Policy")?.value ?? "";
const problems = [];
const allowsInline = (kind) => new RegExp(`${kind}-src[^;]*'unsafe-inline'`).test(csp);

if (!allowsInline("style")) {
  if (/<style[\s>]/i.test(html)) problems.push("a <style> block (blocked by the CSP: put the CSS in a file in public/)");
  if (/\sstyle\s*=/i.test(html)) problems.push("a style=\"...\" attribute (blocked by the CSP: use a class)");
}
if (!allowsInline("script")) {
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/\ssrc\s*=/.test(m[1]) && m[2].trim()) problems.push("a <script> written inside the page (blocked by the CSP: put it in a file in public/)");
  }
  if (/\son[a-z]+\s*=/i.test(html)) problems.push("an onclick/onload-style attribute (blocked by the CSP)");
}
// every local file the page loads must really be there
for (const m of html.matchAll(/\s(?:src|href)="(\/[^"#?]*)"/g)) {
  const path = m[1] === "/" ? null : `dist${m[1]}`;
  if (path && !existsSync(path)) problems.push(`missing file ${m[1]}`);
}
// the opening animation must start hidden, so it can never show without its styles
if (html.includes('id="tl-intro"') && !/id="tl-intro"[^>]*\shidden/.test(html)) problems.push("#tl-intro must have the hidden attribute");

if (problems.length) {
  console.error("The page breaks the site's security policy:\n- " + [...new Set(problems)].join("\n- "));
  process.exit(1);
}
console.log("Page OK: no inline code, every file it loads is there.");
