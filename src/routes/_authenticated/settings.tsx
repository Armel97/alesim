import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Check, Globe, Loader2, TriangleAlert } from "lucide-react";
import { AuthedNav } from "@/components/AuthedNav";
import { useLang, type Lang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "ALESIM — Paramètres" },
      {
        name: "description",
        content:
          "Choisissez la langue de l'interface ALESIM : votre préférence est enregistrée sur votre profil.",
      },
      { property: "og:title", content: "ALESIM — Paramètres" },
      {
        property: "og:description",
        content:
          "Choisissez la langue de l'interface ALESIM : votre préférence est enregistrée sur votre profil.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

const LANG_LABELS: Record<Lang, { short: string; full: string }> = {
  fr: { short: "FR", full: "Français" },
  en: { short: "EN", full: "English" },
};

type SaveState = "idle" | "saving" | "saved" | "error";

function SettingsPage() {
  const { t, lang, setLang } = useLang();
  const [stored, setStored] = useState<Lang | null>(null);
  const [state, setState] = useState<SaveState>("idle");

  const refresh = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) return;
    const { data } = await supabase.from("profiles").select("ui_lang").eq("id", uid).maybeSingle();
    const v = data?.ui_lang;
    if (v === "fr" || v === "en") setStored(v);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const choose = async (l: Lang) => {
    setLang(l);
    setState("saving");
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) {
      setState("error");
      return;
    }
    const { error } = await supabase.from("profiles").update({ ui_lang: l }).eq("id", uid);
    if (error) {
      setState("error");
      return;
    }
    setStored(l);
    setState("saved");
  };

  return (
    <div className="min-h-screen bg-background">
      <AuthedNav />
      <main className="mx-auto w-full max-w-3xl px-6 pb-16">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{t.settings}</p>
        <h1 className="mt-2 font-serif text-3xl">{t.settingsTitle}</h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">{t.settingsLead}</p>

        <section className="mt-8 rounded-3xl border bg-card p-6">
          <div className="flex items-start gap-3">
            <Globe className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
            <div className="flex-1">
              <h2 className="font-medium">{t.uiLanguage}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.uiLanguageHint}</p>

              <div
                role="radiogroup"
                aria-label={t.uiLanguage}
                className="mt-4 grid gap-3 sm:grid-cols-2"
              >
                {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={lang === l}
                    lang={l}
                    onClick={() => void choose(l)}
                    className={`flex min-h-[56px] items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                      lang === l ? "border-primary bg-primary/10" : "hover:bg-secondary/60"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-medium">{LANG_LABELS[l].full}</span>
                      <span className="block text-xs text-muted-foreground">
                        {LANG_LABELS[l].short}
                      </span>
                    </span>
                    {lang === l && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                  </button>
                ))}
              </div>

              <p aria-live="polite" className="mt-4 flex items-center gap-2 text-sm">
                {state === "saving" && (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="text-muted-foreground">{t.savingOnProfile}</span>
                  </>
                )}
                {state === "error" && (
                  <>
                    <TriangleAlert className="h-4 w-4 text-destructive" aria-hidden="true" />
                    <span className="text-destructive">{t.saveFailed}</span>
                  </>
                )}
                {state !== "saving" && state !== "error" && stored && (
                  <>
                    <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span className="text-muted-foreground">
                      {t.savedOnProfile} — {t.profileValue} :{" "}
                      <span className="font-medium text-foreground">
                        {LANG_LABELS[stored].full}
                      </span>
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
