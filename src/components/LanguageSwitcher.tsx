import { useLang, type Lang } from "@/lib/i18n";

const LABELS: Record<Lang, { short: string; full: string }> = {
  fr: { short: "FR", full: "Français" },
  en: { short: "EN", full: "English" },
};

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div
      role="group"
      aria-label={lang === "fr" ? "Langue de l'interface" : "Interface language"}
      className={`flex items-center rounded-full border bg-card p-0.5 text-xs font-medium ${className}`}
    >
      {(Object.keys(LABELS) as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          title={LABELS[l].full}
          className={`min-h-11 min-w-11 rounded-full px-3 py-1.5 transition-colors ${
            lang === l
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span aria-hidden="true">{LABELS[l].short}</span>
          <span className="sr-only">{LABELS[l].full}</span>
        </button>
      ))}
    </div>
  );
}
