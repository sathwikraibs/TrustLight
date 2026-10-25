import { useState } from "react";
import { useI18n } from "@/i18n";
import { useInstall, isInstalledApp, isPhoneOrTablet, installHow } from "@/share";
import { IconPhone, IconClose, IconCheck, BrandMark } from "@/icons";
import { cameToReinstall } from "@/moved";

const HIDE_KEY = "staysafe.installHidden.v1";

function hiddenOnHome(): boolean {
  if (cameToReinstall()) return false;   // came from "TrustLight has a new address"
  try { return localStorage.getItem(HIDE_KEY) === "1"; } catch { return false; }
}

/**
 * "Add TrustLight to your phone", so people can share messages, links and screenshots to it.
 * place="home": only when it can be added, and it can be closed.
 * place="settings": also shows how to share once TrustLight is on the phone.
 * After "Add to my phone": an installing animation until Android confirms (that can take a few minutes),
 * then "TrustLight is installed on your phone", which stays on the home page in Chrome from then on.
 * When the browser gives no install button (iPhone, some browsers, Chrome after a "No", or a link opened
 * inside Instagram/Facebook), the card shows that browser's own steps instead.
 * Never shown on laptops and desktop computers.
 */
export function InstallCard({ place }: { place: "home" | "settings" }) {
  const { t } = useI18n();
  const { canInstall, phase, install } = useInstall();
  const [hidden, setHidden] = useState(hiddenOnHome);
  const installed = isInstalledApp();          // running inside the installed app right now
  const phone = isPhoneOrTablet();

  if (!phone) return null;                       // "Add to your phone" means nothing on a laptop or PC

  const close = () => {
    setHidden(true);
    try { localStorage.setItem(HIDE_KEY, "1"); } catch { /* ignore */ }
  };

  // Just added: installing, then installed (shown even if the card was closed before)
  if (!installed && (phase === "installing" || phase === "installed")) {
    const done = phase === "installed";
    return (
      <div className="relative mb-6 rounded-2xl bg-brand-100 p-5 shadow-warm animate-fade-up" role="status" aria-live="polite">
        <div className="flex items-start gap-3">
          <div className="relative h-11 w-11 shrink-0">
            <BrandMark className={`h-11 w-11 rounded-xl ${done ? "" : "install-pulse"}`} />
            {done && (
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-sage-500 text-cream-50 ring-2 ring-brand-100">
                <IconCheck className="h-3 w-3" strokeWidth={3} />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-base font-semibold text-ink-900">
              {done ? t("install.installedTitle") : t("install.installingTitle")}
            </h2>
            <p className="mt-1 font-body text-sm text-ink-800">{done ? t("install.installedText") : t("install.installing")}</p>
          </div>
        </div>
        {!done && (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-cream-50" aria-hidden>
            <div className="install-bar h-full w-1/3 rounded-full bg-brand-500" />
          </div>
        )}
      </div>
    );
  }

  const manual = !canInstall && !installed;    // no install button from the browser: show the steps
  const how = installHow();
  if (place === "home" && (hidden || installed)) return null;

  return (
    <div className="relative mb-6 rounded-2xl bg-brand-100 p-5 shadow-warm animate-fade-up">
      {place === "home" && (
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
          <p className="mt-1 font-body text-sm text-ink-800">{installed && !canInstall ? t("install.done") : t("install.text")}</p>
          {installed && how !== "ios" && <p className="mt-2 font-body text-xs text-dustyblue-600">{t("install.tip")}</p>}
          {manual && (
            <p className="mt-3 rounded-xl bg-cream-50 px-3 py-2.5 font-body text-sm font-semibold text-ink-900">
              {t(`install.how.${how}`)}
            </p>
          )}
          {how === "ios" && !installed && <p className="mt-2 font-body text-xs text-dustyblue-600">{t("install.iosNote")}</p>}
        </div>
      </div>
      {canInstall && (
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => { void install(); }}
            className="btn-press flex-1 rounded-xl bg-brand-500 px-4 py-3 font-body text-sm font-bold text-cream-50 shadow-warm-sm hover:bg-brand-600">
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
