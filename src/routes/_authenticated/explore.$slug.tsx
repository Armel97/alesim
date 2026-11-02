import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { AuthedNav } from "@/components/AuthedNav";
import { getContentBySlug, recordContentView } from "@/lib/content.functions";
import { CelebrationModal } from "@/components/CelebrationModal";
import type { UnlockedBadge } from "@/lib/badges.server";
import { ArrowLeft, Clock, Sparkles, ChevronRight, X } from "lucide-react";
import { advanceQueue, clearQueue, getQueue, type ReinforceQueue } from "@/lib/reinforce-queue";
import {
  setConfidenceResume,
  clearConfidenceResume,
  type ConfidenceKind,
} from "@/lib/resume-store";

export const Route = createFileRoute("/_authenticated/explore/$slug")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "ALESIM — Contenu" },
      { name: "description", content: "Contenu ALESIM." },
      { property: "og:title", content: "ALESIM — Contenu" },
      { property: "og:description", content: "Contenu ALESIM." },
    ],
  }),
  component: ContentPage,
});

type Content = {
  id: string;
  slug: string;
  theme: string;
  level: string;
  duration_min: number;
  title_fr: string;
  title_en: string;
  body_fr: string;
  body_en: string;
};

function ContentPage() {
  const { slug } = useParams({ from: "/_authenticated/explore/$slug" });
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [content, setContent] = useState<Content | null>(null);
  const [newBadges, setNewBadges] = useState<UnlockedBadge[]>([]);
  const [queue, setQueueState] = useState<ReinforceQueue | null>(null);

  useEffect(() => {
    (async () => {
      const c = (await getContentBySlug({ data: { slug } })) as Content | null;
      setContent(c);
      if (c) {
        try {
          const res = await recordContentView({ data: { contentId: c.id } });
          if (res.newBadges?.length) setNewBadges(res.newBadges);
        } catch (_) {
          // Non-blocking
        }
        const kind: ConfidenceKind | null =
          c.theme === "breathing"
            ? "breathing"
            : c.theme === "articulation"
              ? "articulation"
              : c.theme === "confidence"
                ? "guided"
                : null;
        if (kind) {
          let focus: "confidence" | "pace" | "pronunciation" | null = null;
          try {
            const raw = localStorage.getItem("alesim:today-focus:v1");
            if (raw === "confidence" || raw === "pace" || raw === "pronunciation") {
              focus = raw;
            }
          } catch {
            /* ignore */
          }
          setConfidenceResume({
            slug: c.slug,
            kind,
            level: (c.level as "beginner" | "intermediate" | "advanced") || "beginner",
            focus,
            title: lang === "fr" ? c.title_fr : c.title_en,
            savedAt: Date.now(),
          });
        }
      }
    })();
    setQueueState(getQueue());
  }, [slug]);

  if (!content) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        {t.analyzing}
      </div>
    );
  }

  const themeLabel =
    content.theme === "breathing"
      ? t.themeBreathing
      : content.theme === "articulation"
        ? t.themeArticulation
        : content.theme === "confidence"
          ? t.themeConfidence
          : t.themeCommunication;
  const levelLabel =
    content.level === "beginner"
      ? t.levelBeginner
      : content.level === "intermediate"
        ? t.levelIntermediate
        : t.levelAdvanced;

  const inQueue = queue && queue.slugs.includes(slug);
  const currentIdx = inQueue ? queue!.slugs.indexOf(slug) : -1;
  const nextSlug = inQueue ? queue!.slugs[currentIdx + 1] : undefined;
  const themeName = (th: string) =>
    th === "breathing"
      ? t.themeBreathing
      : th === "articulation"
        ? t.themeArticulation
        : th === "confidence"
          ? t.themeConfidence
          : t.themeCommunication;

  const goNext = () => {
    if (!queue || !nextSlug) return;
    advanceQueue(slug);
    navigate({ to: "/explore/$slug", params: { slug: nextSlug } });
  };
  const finishQueue = () => {
    clearQueue();
    setQueueState(null);
    clearConfidenceResume();
    navigate({ to: "/explore" });
  };

  return (
    <div className="min-h-screen bg-background">
      <AuthedNav />
      <main className="mx-auto w-full max-w-2xl px-6 pb-16">
        <Link
          to="/explore"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t.explore}
        </Link>
        {inQueue && (
          <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  <Sparkles className="h-3 w-3" />
                  {t.queueTitle} — {themeName(queue!.theme)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{t.queueLead}</p>
                <p className="mt-1 text-xs text-foreground">
                  {t.queueProgress} {currentIdx + 1} / {queue!.slugs.length}
                  {queue!.targetMin
                    ? ` · ${t.approxMin.replace("{n}", String(queue!.targetMin))}`
                    : ""}
                </p>
              </div>
              <button
                onClick={finishQueue}
                aria-label={t.queueFinish}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-background">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${((currentIdx + 1) / queue!.slugs.length) * 100}%` }}
              />
            </div>
            {queue!.reasons?.[slug]?.length ? (
              <div className="mt-3 rounded-xl bg-background/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.queueWhyTitle}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {queue!.reasons![slug].map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
        <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="rounded-full bg-secondary px-2 py-0.5">{themeLabel}</span>
          <span>{levelLabel}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {content.duration_min} {t.minutes}
          </span>
        </div>
        <h1 className="mt-3 font-serif text-4xl">
          {lang === "fr" ? content.title_fr : content.title_en}
        </h1>
        <div className="mt-6 rounded-2xl border bg-card p-8">
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
            {lang === "fr" ? content.body_fr : content.body_en}
          </p>
        </div>
        {inQueue && (
          <div className="mt-6 flex flex-wrap gap-3">
            {nextSlug ? (
              <button
                onClick={goNext}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                {t.queueNext}
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={finishQueue}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                {t.queueFinish}
              </button>
            )}
          </div>
        )}
      </main>
      <CelebrationModal badges={newBadges} onClose={() => setNewBadges([])} />
    </div>
  );
}
