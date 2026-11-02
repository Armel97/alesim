import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ALESIM — Nouveau mot de passe" },
      {
        name: "description",
        content: "Choisissez un nouveau mot de passe pour votre compte ALESIM en toute sécurité.",
      },
      { property: "og:title", content: "ALESIM — Nouveau mot de passe" },
      {
        property: "og:description",
        content: "Choisissez un nouveau mot de passe pour votre compte ALESIM en toute sécurité.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Mot de passe mis à jour.");
    navigate({ to: "/today" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-ink text-primary-foreground">
            <span className="font-serif text-lg">A</span>
          </span>
          <span className="font-serif text-2xl tracking-tight text-foreground">ALESIM</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
          <h1 className="font-serif text-3xl">Nouveau mot de passe</h1>
          {!ready ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Ouvrez cette page depuis le lien reçu par email. Si le lien a expiré,{" "}
              <Link to="/auth" className="underline underline-offset-2">
                demandez-en un nouveau
              </Link>
              .
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Choisissez un mot de passe d'au moins 6 caractères.
              </p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="new-password">
                    Nouveau mot de passe
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="confirm-password">
                    Confirmer le mot de passe
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={6}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {loading ? "Mise à jour…" : "Mettre à jour le mot de passe"}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
