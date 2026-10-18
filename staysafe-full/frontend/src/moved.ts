/**
 * TrustLight's web address changed once (staysafe-tool.vercel.app -> trustlight-app.vercel.app).
 * A phone app that was added from the old address stays tied to it: sharing from WhatsApp and
 * other apps goes to the old address and arrives empty. This finds those phones and asks the
 * person to add TrustLight again from the new address (a one-time step).
 */
import { useEffect, useState } from "react";

export const HOME = "https://trustlight-app.vercel.app";
const OLD_HOSTS = ["staysafe-tool.vercel.app"];
const LATER_KEY = "trustlight.moved.later";

let lost = false;
const listeners = new Set<(v: boolean) => void>();

/** True when this page is running on an old TrustLight address. */
export function onOldAddress(): boolean {
  try { return OLD_HOSTS.includes(location.hostname); } catch { return false; }
}

/** Something was shared to TrustLight but nothing arrived: the phone app is the old one. */
export function markShareLost(): void {
  if (lost) return;
  lost = true;
  listeners.forEach((fn) => fn(true));
}

/** The link that opens the new TrustLight and offers "Add to my phone" straight away. */
export function reinstallLink(): string {
  return `${HOME}/?reinstall=1`;
}

/** True when the "TrustLight has a new address" window should be shown. */
export function useMovedNotice(): [boolean, () => void] {
  const [show, setShow] = useState(() => {
    if (!onOldAddress()) return lost;
    try { return sessionStorage.getItem(LATER_KEY) !== "1"; } catch { return true; }
  });
  useEffect(() => {
    listeners.add(setShow);
    return () => { listeners.delete(setShow); };
  }, []);
  const later = () => {
    setShow(false);
    try { sessionStorage.setItem(LATER_KEY, "1"); } catch { /* ignore */ }
  };
  return [show, later];
}

/** Opened from the reinstall link: show "Add to my phone" even if it was closed before. */
export function cameToReinstall(): boolean {
  try { return new URLSearchParams(location.search).has("reinstall"); } catch { return false; }
}
