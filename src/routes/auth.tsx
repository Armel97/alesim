import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useLang } from "@/lib/i18n";
import { LEGAL_LINKS } from "@/lib/legal-content";
import { loadGuestResult } from "@/lib/guest-session";
import { track } from "@/lib/analytics";
import { toast } from "sonner";

// Connexion Google/Apple : passe par le service Lovable, désactivée hors Lovable.
// Mettre VITE_ENABLE_OAUTH=true dans .env pour réafficher les boutons.
const OAUTH_ENABLED = import.meta.env.VITE_ENABLE_OAUTH === "true";

type AuthSearch = { intent?: "signin" | "signup"; next?: string };

/** Chemin relatif same-origin uniquement (protection open-redirect). */
function safeNext(value: unknown): string | undefined {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : undefined;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => {
    const out: AuthSearch = {};
    if (search["intent"] === "signup" || search["intent"] === "signin")
      out.intent = search["intent"];
    const next = safeNext(search["next"]);
    if (next) out.next = next;
    return out;
  },
  head: () => ({
    meta: [
      { title: "ALESIM — Connexion" },
      {
        name: "description",
        content: "Connectez-vous à ALESIM pour sauvegarder votre progression vocale.",
      },
      { property: "og:title", content: "ALESIM — Connexion" },
      {
        property: "og:description",
        content: "Connectez-vous à ALESIM pour sauvegarder votre progression vocale.",
      },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: "https://alesimspeak.dev/auth" }],
  }),
  component: AuthPage,
});

/** Après authentification : on revient au résultat enrichi si un contexte invité existe. */
function destination(): "/" | "/today" {
  return loadGuestResult() ? "/" : "/today";
}

function AuthPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { intent, next } = Route.useSearch();
  /** Redirection post-auth : `next` (ex. consentement OAuth) prime sur le parcours normal. */
  const goAfterAuth = () => {
    if (next) {
      window.location.href = next;
      return;
    }
    navigate({ to: destination() });
  };
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "sent">(
    intent === "signup" ? "signup" : "signin",
  );
  const [showEmail, setShowEmail] = useState(!OAUTH_ENABLED);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const needsAcceptance = mode === "signup" && !acceptedTerms;

  useEffect(() => {
    track("auth_view", { intent: intent ?? "signin" });
  }, [intent]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      if (next) window.location.href = next;
      else navigate({ to: destination() });
    });
  }, [navigate, next]);

  useEffect(() => {
    if (mode === "forgot") setShowEmail(true);
  }, [mode]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (mode === "signin" || mode === "signup")
      track("auth_method_click", { method: "email", intent: mode });
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        toast.success(
          "Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé.",
        );
        setMode("sent");
        return;
      }
      if (mode === "signup") {
        if (!acceptedTerms) {
          toast.error(
            "Vous devez accepter les CGU et la politique de confidentialité pour créer un compte.",
          );
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + (next ?? destination()) },
        });
        if (error) throw error;
        track("signup_success", { method: "email" });
        if (!data.session) {
          // Confirmation par email activée : pas encore connecté.
          toast.success("Compte créé. Cliquez sur le lien reçu par email pour l'activer.");
          return;
        }
        toast.success("Compte créé.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        track("signin_success", { method: "email" });
      }
      goAfterAuth();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "apple") {
    if (needsAcceptance) {
      toast.error(
        "Vous devez accepter les CGU et la politique de confidentialité pour créer un compte.",
      );
      return;
    }
    setLoading(true);
    track("auth_method_click", { method: provider, intent: mode });
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin + (next ?? ""),
    });
    if (result.error) {
      toast.error(result.error.message);
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    track(mode === "signup" ? "signup_success" : "signin_success", { method: provider });
    goAfterAuth();
  }

  if (mode === "sent") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="px-6 py-6">
          <Brand />
        </header>
        <main className="flex flex-1 items-center justify-center px-6 pb-16">
          <div
            role="status"
            aria-live="polite"
            className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm"
          >
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-2xl">
              ✉️
            </span>
            <h1 className="mt-5 font-serif text-3xl">Vérifiez votre boîte mail</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Si un compte existe pour <span className="font-medium text-foreground">{email}</span>,
              un lien sécurisé de réinitialisation vient d'être envoyé. Il expire après un court
              délai.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Pensez à regarder dans vos courriers indésirables si vous ne le voyez pas d'ici
              quelques minutes.
            </p>
            <button
              onClick={() => setMode("forgot")}
              disabled={loading}
              className="mt-6 w-full rounded-full border px-4 py-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"
            >
              Renvoyer le lien
            </button>
            <button
              onClick={() => setMode("signin")}
              className="mt-3 w-full text-xs text-muted-foreground underline"
            >
              Retour à la connexion
            </button>
          </div>
        </main>
      </div>
    );
  }

  const isSignup = mode === "signup";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-6">
        <Brand />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
          {mode !== "forgot" && (
            <div
              role="tablist"
              aria-label="Connexion ou création de compte"
              className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-secondary p-1"
            >
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  type="button"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors ${
                    mode === m
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "signin" ? "Se connecter" : "Créer un compte"}
                </button>
              ))}
            </div>
          )}

          <h1 className="font-serif text-3xl">
            {mode === "forgot" ? "Mot de passe oublié" : isSignup ? "Créer un compte" : t.authTitle}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "forgot"
              ? "Saisissez votre adresse email : nous vous enverrons un lien sécurisé pour choisir un nouveau mot de passe."
              : isSignup
                ? "Gratuit, sans carte bancaire. 2 minutes."
                : t.authLead}
          </p>

          {OAUTH_ENABLED && mode !== "forgot" && (
            <div className="mt-6 space-y-3">
              <button
                onClick={() => handleOAuth("google")}
                disabled={loading || needsAcceptance}
                className="w-full rounded-full border px-4 py-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"
              >
                Continuer avec Google
              </button>
              <button
                onClick={() => handleOAuth("apple")}
                disabled={loading || needsAcceptance}
                className="w-full rounded-full border px-4 py-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"
              >
                Continuer avec Apple
              </button>
            </div>
          )}

          {isSignup && (
            <div className="mt-4 rounded-xl border bg-secondary/40 p-3">
              <label className="flex items-start gap-3 text-xs leading-relaxed text-foreground/80">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primary)]"
                  aria-describedby="legal-accept-desc"
                />
                <span id="legal-accept-desc">
                  J'ai lu et j'accepte les{" "}
                  <Link to="/legal/cgu" target="_blank" className="underline underline-offset-2">
                    conditions générales d'utilisation
                  </Link>{" "}
                  et la{" "}
                  <Link
                    to="/legal/confidentialite"
                    target="_blank"
                    className="underline underline-offset-2"
                  >
                    politique de confidentialité
                  </Link>
                  , y compris le traitement de mes enregistrements audio, vidéo et CV décrit dans
                  cette dernière.
                </span>
              </label>
            </div>
          )}

          {!showEmail && mode !== "forgot" ? (
            <button
              type="button"
              onClick={() => setShowEmail(true)}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Utiliser mon email à la place
            </button>
          ) : (
            <>
              {OAUTH_ENABLED && mode !== "forgot" && (
                <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  {t.or}
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <form onSubmit={handleEmail} className="mt-4 space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="auth-email">
                    {t.email}
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                </div>
                {mode !== "forgot" && (
                  <div>
                    <label className="text-xs text-muted-foreground" htmlFor="auth-password">
                      {t.password}
                    </label>
                    <input
                      id="auth-password"
                      type="password"
                      required
                      minLength={6}
                      autoComplete={isSignup ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                )}
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="inline-flex min-h-11 items-center self-start text-xs text-muted-foreground underline underline-offset-2"
                  >
                    Mot de passe oublié ?
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading || needsAcceptance}
                  className="w-full rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {mode === "forgot"
                    ? "Envoyer le lien de réinitialisation"
                    : isSignup
                      ? "Créer mon compte gratuit"
                      : t.signIn}
                </button>
              </form>
              {mode === "forgot" && (
                <button
                  onClick={() => setMode("signin")}
                  className="mt-3 w-full text-xs text-muted-foreground underline"
                >
                  Retour à la connexion
                </button>
              )}
            </>
          )}

          <nav
            aria-label="Informations légales"
            className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground"
          >
            {LEGAL_LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </main>
    </div>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-ink text-primary-foreground">
        <span className="font-serif text-lg">A</span>
      </span>
      <span className="font-serif text-2xl tracking-tight text-foreground">ALESIM</span>
    </Link>
  );
}
