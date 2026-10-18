import { useI18n } from "@/i18n";
import { useMovedNotice, reinstallLink } from "@/moved";
import { BrandMark } from "@/icons";

/** "TrustLight has a new address": shown once to phones that still have the app from the old address. */
export function MovedGate() {
  const [show, later] = useMovedNotice();
  const { t } = useI18n();
  if (!show) return null;
  return (
    <div
      role="alertdialog" aria-modal="true" aria-labelledby="moved-title" aria-describedby="moved-body"
      className="fixed inset-0 z-[99] flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-md"
    >
      <div className="w-full max-w-sm rounded-3xl bg-cream-50 p-6 shadow-warm-lg animate-fade-up">
        <BrandMark className="mx-auto h-14 w-14" />
        <h2 id="moved-title" className="mt-4 text-center font-heading text-xl font-bold text-ink-900">{t("moved.title")}</h2>
        <p id="moved-body" className="mt-2 text-center font-body text-sm leading-relaxed text-ink-700">{t("moved.body")}</p>
        <ol className="mt-4 space-y-2 font-body text-sm text-ink-800">
          {["moved.step1", "moved.step2", "moved.step3"].map((k, i) => (
            <li key={k} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">{i + 1}</span>
              <span>{t(k)}</span>
            </li>
          ))}
        </ol>
        <a
          href={reinstallLink()} target="_blank" rel="noopener"
          className="btn-press mt-5 block w-full rounded-2xl bg-brand-600 px-5 py-3.5 text-center font-body text-base font-bold text-cream-50 shadow-warm hover:bg-brand-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
        >
          {t("moved.open")}
        </a>
        <button type="button" onClick={later}
          className="btn-press mt-2 w-full rounded-2xl px-5 py-2.5 font-body text-sm font-semibold text-dustyblue-600 hover:bg-cream-100">
          {t("moved.later")}
        </button>
      </div>
    </div>
  );
}
