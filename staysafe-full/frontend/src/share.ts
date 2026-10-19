// "Share to TrustLight": things people share from other apps (a message, a link, a screenshot,
// a file) arrive through the service worker (public/sw.js) and open the right check, which
// then starts by itself. Also: the "Add TrustLight to your phone" button.
import { useEffect, useState } from "react";
import { setPrefill } from "@/helpBot";
import { markShareLost } from "@/moved";

const SHARE_CACHE = "staysafe-share";
const AUTORUN_KEY = "staysafe.autorun.v1";

export type SharedFileKind = "screenshot" | "file";
let pendingFile: { kind: SharedFileKind; file: File } | null = null;
let pendingQr: string | null = null;

/** Start the service worker (needed for sharing and for adding TrustLight to the phone). */
export function registerServiceWorker(): void {
  try {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    if (location.hostname === "localhost" && !import.meta.env.PROD) return;
    const start = () => { navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined); };
    if (document.readyState === "complete") start(); else window.addEventListener("load", start);
  } catch { /* sharing simply isn't offered */ }
}

const URL_ONLY = /^(https?:\/\/|www\.)\S+$/i;

/** The one link in the shared text, if the text is nothing but a link. */
export function loneLink(s: string): string | null {
  const v = s.trim();
  return v && URL_ONLY.test(v) && !/\s/.test(v) ? v : null;
}

/** Work out which check fits what was shared. Exported for tests. */
export function routeForShared(data: { title?: string; text?: string; url?: string }): { path: string; kind: "url" | "message"; value: string } | null {
  const text = (data.text || "").trim();
  const url = (data.url || "").trim();
  const title = (data.title || "").trim();
  if (!text && !url && !title) return null;
  // Browsers share a page as title = page name, text/url = the address
  const link = loneLink(text) || (!text ? loneLink(url) : null);
  if (link && (!url || url === link || loneLink(url))) return { path: "/scan-url", kind: "url", value: link };
  if (!text && url) return { path: "/scan-url", kind: "url", value: url };
  let message = text || title;
  if (url && !message.includes(url)) message = `${message}\n${url}`;
  return { path: "/scan-message", kind: "message", value: message.slice(0, 5000) };
}

/** Read a QR code in a picture on the phone itself, when the browser can (Android Chrome). */
async function qrInPicture(file: File): Promise<string | null> {
  try {
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: ImageBitmap) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    if (!Detector) return null;
    const bitmap = await createImageBitmap(file);
    const codes = await new Detector({ formats: ["qr_code"] }).detect(bitmap);
    bitmap.close?.();
    const v = codes.find((c) => c.rawValue && c.rawValue.trim())?.rawValue.trim();
    return v || null;
  } catch {
    return null;
  }
}

/** If TrustLight was opened by sharing something to it: which page to open (and get ready to check). */
export async function receiveShare(): Promise<string | null> {
  try {
    const params = new URLSearchParams(location.search);
    if (!params.has("shared")) return null;
    history.replaceState(null, "", location.pathname + location.hash);
    if (!("caches" in window)) { markShareLost(); return null; }
    const cache = await caches.open(SHARE_CACHE);
    const res = await cache.match("/__share/data");
    if (!res) { markShareLost(); return null; }   // shared from an app added at the old address
    const data = await res.json() as { title?: string; text?: string; url?: string; file?: { name: string; type: string } | null };
    const fileRes = data.file ? await cache.match("/__share/file") : undefined;
    await cache.delete("/__share/data");
    await cache.delete("/__share/file");

    if (fileRes && data.file) {
      const blob = await fileRes.blob();
      const type = data.file.type || blob.type || "";
      const file = new File([blob], data.file.name || (type.startsWith("image/") ? "shared-picture.jpg" : "shared-file"), { type });
      if (type.startsWith("image/") && type !== "image/svg+xml") {
        const qr = await qrInPicture(file);
        if (qr) { pendingQr = qr; return "/scan-qr"; }
        pendingFile = { kind: "screenshot", file };
        return "/scan-message";
      }
      pendingFile = { kind: "file", file };
      return "/scan-file";
    }

    const route = routeForShared(data);
    if (!route) return null;
    setPrefill(route.kind, route.value);
    try { sessionStorage.setItem(AUTORUN_KEY, route.kind); } catch { /* ignore */ }
    return route.path;
  } catch {
    return null;
  }
}

/** For the link and message pages: true once, when the shared text should be checked straight away. */
export function takeAutoRun(kind: "url" | "message"): boolean {
  try {
    if (sessionStorage.getItem(AUTORUN_KEY) !== kind) return false;
    sessionStorage.removeItem(AUTORUN_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Give a picture or file to the screenshot or file page (used when it was uploaded in the wrong tool). */
export function handOffFile(kind: SharedFileKind, file: File): void { pendingFile = { kind, file }; }
/** Give the text of a QR code to the QR page. */
export function handOffQr(text: string): void { pendingQr = text; }

/** For the screenshot and file pages: the picture or file shared to TrustLight (given once). */
export function useSharedFile(kind: SharedFileKind, take: (file: File) => void): void {
  useEffect(() => {
    if (pendingFile && pendingFile.kind === kind) {
      const f = pendingFile.file;
      pendingFile = null;
      take(f);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);
}

/** For the QR page: what the QR code in a shared picture says (given once). */
export function useSharedQr(take: (text: string) => void): void {
  useEffect(() => {
    if (pendingQr) {
      const v = pendingQr;
      pendingQr = null;
      take(v);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ---- "Add TrustLight to your phone" ----
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let installEvent: InstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
const notify = () => installListeners.forEach((f) => f());

/**
 * Where installing stands: "idle", "installing" (the person said yes; on Android, Google builds the app,
 * which can take from seconds to several minutes) or "installed" (Android confirmed it).
 * "installing" is remembered for 15 minutes, so a reload or a closed tab still shows the progress.
 */
export type InstallPhase = "idle" | "installing" | "installed";
const STARTED_KEY = "staysafe.installStarted.v1";
const WAIT_MS = 15 * 60 * 1000;
let phase: InstallPhase = "idle";
let pollTimer: ReturnType<typeof setTimeout> | null = null;

function setPhase(p: InstallPhase): void {
  if (phase === p) return;
  phase = p;
  try {
    if (p === "installing") localStorage.setItem(STARTED_KEY, String(Date.now()));
    else localStorage.removeItem(STARTED_KEY);
  } catch { /* ignore */ }
  notify();
}

/** Android tells pages whether their own app is installed (manifest "related_applications"). */
async function appIsInstalled(): Promise<boolean> {
  try {
    const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
    if (!nav.getInstalledRelatedApps) return false;
    return (await nav.getInstalledRelatedApps()).length > 0;
  } catch {
    return false;
  }
}

/** While installing, check every few seconds whether Android has finished. */
function watchInstall(): void {
  if (pollTimer) clearTimeout(pollTimer);
  const tick = async () => {
    pollTimer = null;
    if (phase !== "installing") return;
    if (await appIsInstalled()) { setPhase("installed"); return; }
    let started = 0;
    try { started = Number(localStorage.getItem(STARTED_KEY) || 0); } catch { /* ignore */ }
    if (started && Date.now() - started > WAIT_MS) { setPhase("idle"); return; }   // gave up waiting: offer it again
    pollTimer = setTimeout(tick, 3000);
  };
  pollTimer = setTimeout(tick, 2500);
}

export function listenForInstall(): void {
  try {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      installEvent = e as InstallPromptEvent;
      notify();
    });
    window.addEventListener("appinstalled", () => {
      installEvent = null;
      setPhase("installed");
    });
    // An install started earlier (before a reload) and not finished yet: keep showing its progress
    let started = 0;
    try { started = Number(localStorage.getItem(STARTED_KEY) || 0); } catch { /* ignore */ }
    if (started && Date.now() - started < WAIT_MS) {
      phase = "installing";
      watchInstall();
    } else if (started) {
      try { localStorage.removeItem(STARTED_KEY); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

/**
 * Opens the installed TrustLight app from the browser. On Android this asks the phone to open the
 * site's address with an app, which is TrustLight once installed; if that can't happen, the page simply
 * reloads in the browser.
 */
export function openInstalledApp(): void {
  try {
    const home = `${location.origin}/`;
    if (/Android/i.test(navigator.userAgent)) {
      location.href = `intent://${location.host}/#Intent;scheme=https;action=android.intent.action.VIEW;` +
        `category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(home)};end`;
    } else {
      location.href = home;
    }
  } catch { /* ignore */ }
}

/** A phone or tablet (not a laptop or desktop computer). Touch laptops still count as computers. */
export function isPhoneOrTablet(): boolean {
  try {
    const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
    if (nav.userAgentData && typeof nav.userAgentData.mobile === "boolean" && nav.userAgentData.mobile) return true;
    const ua = nav.userAgent || "";
    if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini|IEMobile/i.test(ua)) return true;
    // iPads ask for the desktop site and say "Macintosh", but have a touch screen
    return /Macintosh/.test(ua) && (nav.maxTouchPoints || 0) > 1;
  } catch {
    return false;
  }
}

/**
 * Which "add to home screen" steps fit this browser, for when it doesn't offer the install button itself:
 * iPhones never do, other browsers sometimes don't, Chrome stops offering it for a while after someone
 * taps "No", and apps like Instagram open links in their own browser where installing isn't possible.
 */
export type InstallHow = "inapp" | "ios" | "samsung" | "firefox" | "chrome";
export function installHow(): InstallHow {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  if (/FBAN|FBAV|FB_IAB|Instagram|Snapchat|Line\/|Twitter|LinkedInApp|; wv\)|WhatsApp|Telegram/i.test(ua)) return "inapp";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1)) return "ios";
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/Firefox|FxiOS/i.test(ua)) return "firefox";
  return "chrome";
}

export function isInstalledApp(): boolean {
  try {
    return window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

/** Whether the browser offers installing TrustLight, where installing stands, and a function that asks it to. */
export function useInstall(): { canInstall: boolean; phase: InstallPhase; install: () => Promise<boolean> } {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    installListeners.add(f);
    return () => { installListeners.delete(f); };
  }, []);
  return {
    canInstall: !!installEvent && !isInstalledApp() && phase === "idle",
    phase,
    install: async () => {
      const e = installEvent;
      if (!e || phase !== "idle") return false;
      installEvent = null;              // one prompt per event: a second tap can never start a second install
      notify();
      try {
        await e.prompt();
        const choice = await e.userChoice;
        if (choice.outcome === "accepted") {
          setPhase("installing");
          watchInstall();
          return true;
        }
      } catch { /* ignore */ }
      notify();
      return false;
    },
  };
}
