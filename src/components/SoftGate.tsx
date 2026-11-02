import { Link } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Sparkles, LineChart } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useAuthSession } from "@/hooks/useAuthSession";
import { setContinueWithoutAccount } from "@/lib/guest-session";
import { track } from "@/lib/analytics";
import { AppHeader } from "@/components/AppHeader";

const COPY = {
  fr: {
    title: "Sauvegarde ta progression",
    body: "Crée un compte gratuit pour suivre ton évolution dans le temps et débloquer l'historique de tes prises de parole.",
    cta: "Créer mon compte gratuit",
    sub: "Gratuit, sans carte bancaire. 2 minutes.",
    secondary: "Continuer sans compte",
    gateTitle: "Cette page fait partie du suivi",
    gateBody:
      "L'historique, le tableau de bord et la comparaison ont besoin d'un compte pour conserver tes résultats d'une séance à l'autre. Ton dernier résultat reste accessible sans compte.",
    back: "Revenir à mon résultat",
  },
  en: {
    title: "Save your progress",
    body: "Create a free account to track your progress over time and unlock the history of your recordings.",
    cta: "Create my free account",
    sub: "Free, no credit card. 2 minutes.",
    secondary: "Continue without an account",
    gateTitle: "This page is part of progress tracking",
    gateBody:
      "History, dashboard and comparison need an account to keep your results from one session to the next. Your latest result stays available without an account.",
    back: "Back to my result",
  },
} as const;

/** Encart non bloquant affiché sous le résultat d'analyse en mode invité. */
export function SoftGate({ onDismiss }: { onDismiss?: () => void }) {
  const { lang } = useLang();
  const c = COPY[lang === "en" ? "en" : "fr"];

  return (
    <aside className="rounded-3xl border border-border bg-gradient-warm p-6 shadow-soft sm:p-8">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-background/70 text-foreground">
        <Sparkles className="h-5 w-5" />
      </span>
      <h3 className="mt-4 font-serif text-2xl text-foreground">{c.title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-foreground/80">{c.body}</p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link
          to="/auth"
          search={{ intent: "signup" }}
          onClick={() => track("softgate_cta_click", { placement: "soft_gate" })}
          className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
        >
          {c.cta}
        </Link>
        <button
          type="button"
          onClick={() => {
            setContinueWithoutAccount();
            track("softgate_dismiss");
            onDismiss?.();
          }}
          className="inline-flex min-h-11 items-center text-sm text-foreground/70 underline underline-offset-2 hover:text-foreground"
        >
          {c.secondary}
        </button>
      </div>
      <p className="mt-3 text-xs text-foreground/60">{c.sub}</p>
    </aside>
  );
}

/** Mur affiché à la place des pages de suivi (dashboard, historique, comparaison) pour les invités. */
export function TrackingGate({ children }: { children: ReactNode }) {
  const { lang } = useLang();
  const { signedIn, loading } = useAuthSession();
  const c = COPY[lang === "en" ? "en" : "fr"];

  useEffect(() => {
    if (!loading && !signedIn) track("tracking_gate_view");
  }, [loading, signedIn]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-background">
        <AppHeader />
        <div className="mx-auto w-full max-w-4xl px-6 py-16">
          <div className="h-40 animate-pulse rounded-3xl bg-secondary/60" />
        </div>
      </div>
    );
  }

  if (signedIn) return <>{children}</>;

  return (
    <main className="min-h-dvh bg-background">
      <AppHeader />
      <section className="mx-auto w-full max-w-2xl px-6 pb-24 pt-8">
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-foreground">
            <LineChart className="h-6 w-6" />
          </span>
          <h1 className="mt-5 font-serif text-3xl text-foreground">{c.gateTitle}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.gateBody}</p>
          <Link
            to="/auth"
            search={{ intent: "signup" }}
            onClick={() => track("softgate_cta_click", { placement: "tracking_gate" })}
            className="mt-7 inline-flex min-h-11 items-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
          >
            {c.cta}
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">{c.sub}</p>
          <Link
            to="/"
            className="mt-5 inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-2"
          >
            {c.back}
          </Link>
        </div>
      </section>
    </main>
  );
}
