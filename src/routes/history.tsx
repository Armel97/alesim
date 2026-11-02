import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TrackingGate } from "@/components/SoftGate";
import { AppHeader } from "@/components/AppHeader";
import { useLang } from "@/lib/i18n";
import { deleteSession, loadSessions, type Session } from "@/lib/history-store";
import { Trash2, Clock, Gauge } from "lucide-react";
import { bilingualLinks } from "@/lib/seo-lang";

export const Route = createFileRoute("/history")({
  component: GatedHistory,
  head: () => ({
    meta: [
      { title: "Historique — ALESIM" },
      {
        name: "description",
        content:
          "Consultez l'historique de vos séances vocales ALESIM : transcriptions, débit, clarté, confiance et exports PDF/CSV pour suivre votre progression.",
      },
      { property: "og:title", content: "Historique de vos séances — ALESIM" },
      {
        property: "og:description",
        content:
          "Réécoutez vos enregistrements, comparez vos scores de débit, clarté et confiance, et exportez votre progression ALESIM en PDF ou CSV.",
      },
      { property: "og:url", content: "https://alesimspeak.dev/history" },
      { property: "og:image", content: "https://alesimspeak.dev/og-alesim.jpg" },
      { name: "twitter:image", content: "https://alesimspeak.dev/og-alesim.jpg" },
      { name: "robots", content: "noindex, follow" },
    ],
    links: bilingualLinks("/history"),
  }),
});

function HistoryPage() {
  const { t } = useLang();
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  const remove = (id: string) => {
    deleteSession(id);
    setSessions(loadSessions());
  };

  return (
    <main className="min-h-dvh bg-background">
      <AppHeader />
      <section className="mx-auto w-full max-w-4xl px-6 pb-24">
        <h1 className="font-serif text-5xl text-foreground">{t.history}</h1>

        {sessions.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-dashed p-12 text-center">
            <p className="text-muted-foreground">{t.empty}</p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              {t.newSession}
            </Link>
          </div>
        ) : (
          <ul className="mt-10 space-y-4">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="rounded-3xl border bg-card p-6 shadow-soft transition-shadow hover:shadow-glow/30"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{new Date(s.createdAt).toLocaleString(s.lang)}</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {s.durationSec.toFixed(1)}s
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Gauge className="h-3 w-3" />
                        {s.feedback.wpm} {t.wpm}
                      </span>
                    </div>
                    {s.prompt && (
                      <p className="mt-2 text-xs uppercase tracking-wider text-accent">
                        {s.prompt}
                      </p>
                    )}
                    <p className="mt-3 font-serif text-xl leading-snug text-foreground">
                      &ldquo;{s.transcript}&rdquo;
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <Badge label={t.clarity} value={s.feedback.clarity} />
                      <Badge label={t.confidence} value={s.feedback.confidence} />
                      <Badge label={t.fillers} value={s.feedback.fillerCount} suffix="" />
                    </div>
                    {s.feedback.nextChallenge && (
                      <p className="mt-4 rounded-2xl bg-secondary p-3 text-sm text-secondary-foreground">
                        <span className="mr-2 font-medium">{t.nextStep}:</span>
                        {s.feedback.nextChallenge}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    aria-label={t.delete}
                    className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Badge({
  label,
  value,
  suffix = "/100",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">
      {label}:{" "}
      <span className="font-medium">
        {value}
        {suffix}
      </span>
    </span>
  );
}

function GatedHistory() {
  return (
    <TrackingGate>
      <HistoryPage />
    </TrackingGate>
  );
}
