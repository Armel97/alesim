import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie } from "lucide-react";
import {
  readConsent,
  saveConsent,
  OPEN_PREFS_EVENT,
  type CookieConsent,
} from "@/lib/cookie-consent";

export function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [prefs, setPrefs] = useState({ preferences: true, analytics: false });

  useEffect(() => {
    const existing: CookieConsent | null = readConsent();
    if (!existing) setOpen(true);
    else setPrefs({ preferences: existing.preferences, analytics: existing.analytics });

    const onOpen = () => {
      const c = readConsent();
      if (c) setPrefs({ preferences: c.preferences, analytics: c.analytics });
      setCustom(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_PREFS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_PREFS_EVENT, onOpen);
  }, []);

  if (!open) return null;

  function decide(choice: { preferences: boolean; analytics: boolean }) {
    saveConsent(choice);
    setOpen(false);
    setCustom(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Gestion des cookies"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-5 shadow-lg">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Cookie className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-serif text-lg text-foreground">Votre choix sur les cookies</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              ALESIM utilise des traceurs strictement nécessaires au fonctionnement du service. Avec
              votre accord, nous mesurons aussi l'usage de l'application pour l'améliorer. Aucun
              traceur non essentiel n'est déposé avant votre consentement.{" "}
              <Link to="/legal/cookies" className="underline underline-offset-2">
                En savoir plus
              </Link>
            </p>
          </div>
        </div>

        {custom && (
          <div className="mt-4 space-y-2">
            <CategoryRow
              title="Strictement nécessaires"
              desc="Session, sécurité, mémorisation de votre choix. Toujours actifs."
              checked
              disabled
            />
            <CategoryRow
              title="Préférences"
              desc="Langue, thème et réglages d'exercices."
              checked={prefs.preferences}
              onChange={(v) => setPrefs((p) => ({ ...p, preferences: v }))}
            />
            <CategoryRow
              title="Mesure d'audience"
              desc="Statistiques d'usage agrégées (13 mois maximum)."
              checked={prefs.analytics}
              onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))}
            />
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => decide({ preferences: true, analytics: true })}
            className="min-h-11 flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Accepter tout
          </button>
          <button
            type="button"
            onClick={() => decide({ preferences: false, analytics: false })}
            className="min-h-11 flex-1 rounded-full border px-4 py-2.5 text-sm font-medium hover:bg-secondary"
          >
            Refuser tout
          </button>
          {custom ? (
            <button
              type="button"
              onClick={() => decide(prefs)}
              className="min-h-11 flex-1 rounded-full border border-foreground px-4 py-2.5 text-sm font-medium hover:bg-secondary"
            >
              Enregistrer mes choix
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCustom(true)}
              className="min-h-11 flex-1 rounded-full border px-4 py-2.5 text-sm font-medium hover:bg-secondary"
            >
              Personnaliser
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
  title,
  desc,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl border bg-background p-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-primary)] disabled:opacity-50"
        aria-label={title}
      />
    </label>
  );
}
