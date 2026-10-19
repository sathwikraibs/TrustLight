import { useState } from "react";
import { useI18n } from "@/i18n";
import { useInstall, isInstalledApp, isPhoneOrTablet, installHow } from "@/share";
import { IconPhone, IconClose } from "@/icons";
import { cameToReinstall } from "@/moved";

const HIDE_KEY = "staysafe.installHidden.v1";

function hiddenOnHome(): boolean {
  if (cameToReinstall()) return false;   // came from "TrustLight has a new address"
  try { return localStorage.getItem(HIDE_KEY) === "1"; } catch { return false; }
}

/**
 * "Add TrustLight to your phone", so people can share messages, links and screenshots to it.
 * place="home": only when the phone offers it, and it can be closed.
 * place="settings": also shows how to share once TrustLight is on the phone.
 * When the phone's browser doesn't offer the install button (iPhone, some browsers, Chrome after a "No",
 * or a link opened inside Instagram/Facebook), the card shows the steps for that browser instead.
 * Never shown on laptops and desktop computers.
 */
export function InstallCard({ place }: { place: "home" | "settings" }) {
  const { t } = useI18n();
  const { canInstall, installedNow, install } = useInstall();
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(hiddenOnHome);
  const [done, setDone] = useState(false);
  const installed = isInstalledApp();
  const phone = isPhoneOrTablet();

  if (!phone) return null;                       // "Add to your phone" means nothing on a laptop or PC

  const manual = !canInstall && !installed && !done;   // no install button from the browser: show the steps
  const how = installHow();
  if (place === "home" && hidden && !done) return null;
  if (place === "home" && installed && !done) return null;

  const close = () => {
    setHidden(true);
    try { localStorage.setItem(HIDE_KEY, "1"); } catch { /* ignore */ }
  };

  return (
    <div className="relative mb-6 rounded-2xl bg-brand-100 p-5 shadow-warm animate-fade-up">
      {place === "home" && !done && (
        <button type="button" onClick={close} aria-label={t("install.later")}
          className="btn-press absolute right-3 top-3 rounded-full p-1.5 text-dustyblue-600 hover:bg-cream-50">
          <IconClose className="h-4 w-4" />
        </button>
      )}
      <div className="flex items-start gap-3 pr-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-cream-50">
          <IconPhone className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-base font-semibold text-ink-900">{t("install.title")}</h2>
          <p className="mt-1 font-body text-sm text-ink-800">
            {done && !installedNow ? t("install.installing") : done || (installed && !canInstall) ? t("install.done") : t("install.text")}
          </p>
          {(done || installed) && how !== "ios" && <p className="mt-2 font-body text-xs text-dustyblue-600">{t("install.tip")}</p>}
          {manual && (
            <p className="mt-3 rounded-xl bg-cream-50 px-3 py-2.5 font-body text-sm font-semibold text-ink-900">
              {t(`install.how.${how}`)}
            </p>
          )}
          {how === "ios" && !installed && <p className="mt-2 font-body text-xs text-dustyblue-600">{t("install.iosNote")}</p>}
        </div>
      </div>
      {canInstall && !done && (
        <div className="mt-4 flex gap-2">
          <button type="button" disabled={busy}
            onClick={async () => { if (busy) return; setBusy(true); const ok = await install(); setBusy(false); if (ok) setDone(true); }}
            className="btn-press flex-1 disabled:opacity-60 rounded-xl bg-brand-500 px-4 py-3 font-body text-sm font-bold text-cream-50 shadow-warm-sm hover:bg-brand-600">
            {t("install.button")}
          </button>
          {place === "home" && (
            <button type="button" onClick={close}
              className="btn-press rounded-xl border-2 border-brand-300 bg-cream-50 px-4 py-3 font-body text-sm font-bold text-brand-700">
              {t("install.later")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
