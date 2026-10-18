import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { apiGet } from "@/api";
import { API_BASE } from "@/config";
import { isPhoneOrTablet } from "@/share";
import { BrandMark, IconCheck, IconChevronRight } from "@/icons";

/**
 * "Support TrustLight": an optional contribution, shown only when a payment page or UPI ID is set on
 * the server (SUPPORT_LINK / SUPPORT_UPI). The UPI ID itself is never shown on screen: phones get a
 * "Pay with UPI" button, computers a note to open TrustLight on a phone, and a small "Copy UPI ID"
 * button is the backup for UPI apps that don't open payment links.
 */
interface SupportInfo { available: boolean; link: string; upi: string; name: string }

let cached: Promise<SupportInfo | null> | null = null;
function loadSupport(): Promise<SupportInfo | null> {
  cached ??= apiGet<SupportInfo>(`${API_BASE}/api/support`).catch(() => null);
  return cached;
}

/** `collapsible`: shown as one "Support TrustLight  >" row (Settings); tapping it opens all the details. */
export function SupportCard({ collapsible = false }: { collapsible?: boolean }) {
  const { t, tl } = useI18n();
  const [info, setInfo] = useState<SupportInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(!collapsible);
  useEffect(() => { let on = true; void loadSupport().then((i) => { if (on) setInfo(i); }); return () => { on = false; }; }, []);
  if (!info?.available) return null;

  const phone = isPhoneOrTablet();
  const upiLink = info.upi ? `upi://pay?pa=${encodeURIComponent(info.upi)}&pn=${encodeURIComponent(info.name || "TrustLight")}&cu=INR&tn=${encodeURIComponent("Support TrustLight")}` : "";
  async function copy() {
    try { await navigator.clipboard.writeText(info!.upi); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  }

  if (!open) {
    return (
      <button type="button" id="support" onClick={() => setOpen(true)} aria-expanded={false}
        className="btn-press card-hover flex w-full items-center gap-3 rounded-2xl bg-cream-50 p-5 text-left shadow-warm">
        <BrandMark className="h-6 w-6 shrink-0 rounded-lg" />
        <span className="flex-1 font-body text-base font-semibold text-ink-800">{t("support.title")}</span>
        <IconChevronRight className="h-5 w-5 text-dustyblue-400" />
      </button>
    );
  }

  return (
    <section id="support" className="rounded-3xl border border-cream-200 bg-cream-50 p-5 shadow-warm-sm sm:p-6">
      {collapsible && (
        <button type="button" onClick={() => setOpen(false)} aria-expanded={true} aria-label={t("common.close")}
          className="float-right -mr-1 -mt-1 rounded-lg p-1 text-dustyblue-400 hover:bg-cream-100">
          <IconChevronRight className="h-5 w-5 -rotate-90" />
        </button>
      )}
      <div className="flex items-start gap-3">
        <BrandMark className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-bold leading-tight text-ink-900">{t("support.title")}</h2>
          <p className="mt-1 font-body text-sm leading-relaxed text-dustyblue-600">{t("support.text")}</p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {tl("support.points").map((p, i) => (
          <li key={i} className="flex items-start gap-2 font-body text-sm text-ink-800">
            <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage-600" strokeWidth={2.4} />{p}
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-3">
        {info.link && (
          <a href={info.link} target="_blank" rel="noopener noreferrer"
            className="btn-press block w-full rounded-xl bg-brand-600 px-5 py-3 text-center font-body text-base font-semibold text-white hover:bg-brand-700">
            {t("support.button")}
          </a>
        )}
        {info.upi && (
          <div className="space-y-2">
            {phone ? (
              <a href={upiLink}
                className={`btn-press block w-full rounded-xl px-5 py-3 text-center font-body text-base font-semibold ${info.link ? "border border-brand-300 bg-cream-50 text-brand-700" : "bg-brand-600 text-white hover:bg-brand-700"}`}>
                {t("support.upiPay")}
              </a>
            ) : (
              <p className="rounded-2xl bg-cream-100 p-3 text-center font-body text-sm text-dustyblue-600">{t("support.phoneHint")}</p>
            )}
            {/* Backup for UPI apps that don't open payment links: copies the ID without showing it */}
            <button type="button" onClick={copy}
              className="block w-full py-1 text-center font-body text-xs font-semibold text-brand-700 hover:underline">
              {copied ? t("support.copied") : t("support.copy")}
            </button>
          </div>
        )}
      </div>

      <p className="mt-4 text-center font-body text-xs text-dustyblue-500">{t("support.note")}</p>
    </section>
  );
}
