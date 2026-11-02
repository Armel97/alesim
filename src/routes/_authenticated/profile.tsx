import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { AuthedNav } from "@/components/AuthedNav";
import { listBadges, getMyBadges } from "@/lib/badges.functions";
import { getMyCompletions } from "@/lib/lessons.functions";
import { getMyContentViews } from "@/lib/content.functions";
import { getMyProfile } from "@/lib/onboarding.functions";
import { Lock, Award, Scale } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { LEGAL_LINKS } from "@/lib/legal-content";
import { openCookiePreferences } from "@/lib/cookie-consent";
import { AudioConsentSettings } from "@/components/AudioConsentSettings";
import { DataErasureForm } from "@/components/DataErasureForm";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "ALESIM — Profil" },
      { name: "description", content: "Vos badges et statistiques de progression ALESIM." },
      { property: "og:title", content: "ALESIM — Profil" },
      { property: "og:description", content: "Vos badges et statistiques de progression ALESIM." },
    ],
  }),
  component: ProfilePage,
});

type Badge = {
  id: string;
  code: string;
  icon: string;
  title_fr: string;
  title_en: string;
  desc_fr: string;
  desc_en: string;
  condition_type: string;
  condition_value: number;
};

function ProfilePage() {
  const { t, lang } = useLang();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ lessons: 0, streak: 0, longest: 0, views: 0 });
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [b, mb, comp, views, profile] = await Promise.all([
        listBadges(),
        getMyBadges(),
        getMyCompletions(),
        getMyContentViews(),
        getMyProfile(),
      ]);
      setBadges(b as Badge[]);
      setUnlocked(new Set(mb.map((r) => r.badge_id)));
      setStats({
        lessons: comp.completions?.length ?? 0,
        streak: comp.streak?.current_streak ?? 0,
        longest: comp.streak?.longest_streak ?? 0,
        views: views.length,
      });
      setDisplayName(profile?.display_name ?? null);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AuthedNav streak={stats.streak} />
      <main className="mx-auto w-full max-w-3xl px-6 pb-16">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{t.profile}</p>
        <h1 className="mt-2 font-serif text-4xl">{displayName ?? t.profileTitle}</h1>

        <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label={t.streak} value={stats.streak} />
          <StatCard label={t.longestStreak} value={stats.longest} />
          <StatCard label={t.lessonsCompleted} value={stats.lessons} />
          <StatCard label={t.contentsViewed} value={stats.views} />
        </section>

        <section className="mt-10">
          <h2 className="font-serif text-2xl">{t.myBadges}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {badges.map((b) => {
              const is = unlocked.has(b.id);
              return (
                <div
                  key={b.id}
                  className={`rounded-2xl border p-4 text-center ${
                    is ? "bg-card" : "bg-muted/40 opacity-70"
                  }`}
                >
                  <div
                    className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full ${
                      is ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {is ? <Award className="h-6 w-6" /> : <Lock className="h-5 w-5" />}
                  </div>
                  <p className="font-medium text-sm">{lang === "fr" ? b.title_fr : b.title_en}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {is ? (lang === "fr" ? b.desc_fr : b.desc_en) : t.locked}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border bg-card p-5">
          <h2 className="flex items-center gap-2 font-serif text-2xl">
            <Scale className="h-5 w-5 text-primary" />
            Informations légales
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Confidentialité, conditions d'utilisation et gestion de vos traceurs.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {LEGAL_LINKS.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="inline-flex min-h-11 items-center rounded-full border px-4 text-sm text-muted-foreground hover:text-foreground"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={openCookiePreferences}
                className="inline-flex min-h-11 items-center rounded-full border px-4 text-sm text-muted-foreground hover:text-foreground"
              >
                Gérer les cookies
              </button>
            </li>
          </ul>
        </section>

        <AudioConsentSettings />
        <div className="mt-10">
          <DataErasureForm />
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-4 text-center">
      <p className="font-serif text-3xl">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
