import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Mic,
  Languages as LanguagesIcon,
  GraduationCap,
  ArrowRight,
  PlayCircle,
  Sparkles,
  Download,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import type { PracticeLang } from "@/lib/language-content";
import { loadSessions, type Session } from "@/lib/history-store";
import { loadPronunciationSessions, type PronunciationSession } from "@/lib/pronunciation-history";
import { getMyCompletions } from "@/lib/lessons.functions";
import { listLessons } from "@/lib/lessons.functions";
import { listBadges, getMyBadges } from "@/lib/badges.functions";
import { getMyContentViews } from "@/lib/content.functions";
import { getMyProfile } from "@/lib/onboarding.functions";
import { buildHistoryPdf, type HistoryBadge } from "@/lib/history-pdf";
import { ExportHistoryDialog } from "./ExportHistoryDialog";
import {
  getPronResume,
  getLessonResume,
  getConfidenceResume,
  type PronResume,
  type LessonResume,
  type ConfidenceResume,
} from "@/lib/resume-store";

type Kind = "speech" | "pron" | "lesson";

type Item = {
  id: string;
  t: number;
  kind: Kind;
  title: string;
  subtitle: string;
  meta: string;
  to: string;
};

export function ActivityTimeline() {
  const { t, lang } = useLang();
  const [speech, setSpeech] = useState<Session[]>([]);
  const [pron, setPron] = useState<PronunciationSession[]>([]);
  const [lessons, setLessons] = useState<
    Array<{ id: string; completed_at: string; title: string }>
  >([]);
  const [allLessons, setAllLessons] = useState<
    Array<{ id: string; title_fr: string; title_en: string }>
  >([]);
  const [pronResume, setPronR] = useState<PronResume | null>(null);
  const [lessonResume, setLessonR] = useState<LessonResume | null>(null);
  const [confResume, setConfR] = useState<ConfidenceResume | null>(null);
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    setSpeech(loadSessions());
    setPron(loadPronunciationSessions());
    setPronR(getPronResume());
    setLessonR(getLessonResume());
    setConfR(getConfidenceResume());
    (async () => {
      try {
        const [{ completions }, all] = await Promise.all([getMyCompletions(), listLessons()]);
        const byId = new Map(all.map((l) => [l.id, l]));
        setAllLessons(all.map((l) => ({ id: l.id, title_fr: l.title_fr, title_en: l.title_en })));
        const rows = (completions ?? [])
          .map((c) => {
            const lesson = byId.get(c.lesson_id);
            if (!lesson) return null;
            return {
              id: c.lesson_id,
              completed_at: c.completed_at,
              title: (lang === "fr" ? lesson.title_fr : lesson.title_en) ?? lesson.title_fr,
            };
          })
          .filter((x): x is { id: string; completed_at: string; title: string } => !!x);
        setLessons(rows);
      } catch {
        // unauthenticated or offline — skip lesson data
      }
    })();
  }, [lang]);

  const items = useMemo<Item[]>(() => {
    const merged: Item[] = [
      ...speech.map((s) => ({
        id: `sp-${s.id}`,
        t: s.createdAt,
        kind: "speech" as const,
        title: t.speaking,
        subtitle: s.transcript || s.prompt || "—",
        meta: `${t.clarity} ${s.feedback.clarity} · ${t.confidence} ${s.feedback.confidence}`,
        to: "/history",
      })),
      ...pron.map((s) => ({
        id: `pr-${s.id}`,
        t: s.createdAt,
        kind: "pron" as const,
        title: `${t.pronunciation} · ${s.lang.toUpperCase()} · ${t.levels[s.level]}`,
        subtitle: s.reference,
        meta: `${t.accuracy} ${s.accuracy} · ${t.fluency} ${s.fluency}`,
        to: "/practice",
      })),
      ...lessons.map((l) => ({
        id: `ls-${l.id}-${l.completed_at}`,
        t: new Date(l.completed_at).getTime(),
        kind: "lesson" as const,
        title: t.lesson,
        subtitle: l.title,
        meta: new Date(l.completed_at).toLocaleDateString(lang, {
          month: "short",
          day: "numeric",
        }),
        to: "/today",
      })),
    ].sort((a, b) => b.t - a.t);
    return filter === "all" ? merged : merged.filter((i) => i.kind === filter);
  }, [speech, pron, lessons, filter, t, lang]);

  const chip = (k: "all" | Kind, label: string) => (
    <button
      key={k}
      type="button"
      onClick={() => setFilter(k)}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        filter === k
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-3xl border bg-card p-6 shadow-soft">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{t.activity}</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{t.activityLead}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {chip("all", t.filterAll)}
          {chip("speech", t.speaking)}
          {chip("pron", t.pronunciation)}
          {chip("lesson", t.lesson)}
          <button
            type="button"
            onClick={() => setShowExport(true)}
            className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
          >
            <Download className="h-3 w-3" />
            {t.exportHistoryPdf}
          </button>
        </div>
      </div>

      <ExportHistoryDialog
        open={showExport}
        onClose={() => setShowExport(false)}
        buildReport={buildReport}
      />

      <ResumeBanner
        pron={pronResume}
        lesson={lessonResume}
        confidence={confResume}
        lessonTitle={(id: string) => {
          const l = allLessons.find((x) => x.id === id);
          if (!l) return "";
          return (lang === "fr" ? l.title_fr : l.title_en) ?? l.title_fr;
        }}
        t={t}
        lang={lang}
      />

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t.noActivity}
        </p>
      ) : (
        <ol className="relative space-y-3 border-l border-border/70 pl-5">
          {items.slice(0, 15).map((it) => (
            <li key={it.id} className="relative">
              <span
                className={`absolute -left-[26px] top-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-card ${dotClass(it.kind)}`}
              >
                {iconFor(it.kind)}
              </span>
              <Link
                to={it.to}
                className="group flex items-start justify-between gap-4 rounded-2xl border bg-background/50 p-4 transition-colors hover:border-accent/60 hover:bg-accent/5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <span>{it.title}</span>
                    <span>·</span>
                    <span>{new Date(it.t).toLocaleString(lang)}</span>
                  </div>
                  <p className="mt-1 truncate font-serif text-lg text-foreground">{it.subtitle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{it.meta}</p>
                </div>
                <span className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground transition-transform group-hover:translate-x-0.5">
                  {t.viewResult}
                  <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );

  async function buildReport(include: { summary: boolean; timeline: boolean; badges: boolean }) {
    type BadgeRow = {
      id: string;
      code: string;
      icon: string;
      title_fr: string;
      title_en: string;
      desc_fr: string;
      desc_en: string;
    };
    type UnlockedRow = { badge_id: string; unlocked_at: string };
    type CompletionsPayload = {
      completions: unknown[];
      streak: { current_streak?: number; longest_streak?: number } | null;
    };
    const [badgesAll, myBadges, views, profile, comp] = await Promise.all([
      listBadges().catch(() => []),
      getMyBadges().catch(() => []),
      getMyContentViews().catch(() => []),
      getMyProfile().catch(() => null),
      getMyCompletions().catch(() => ({ completions: [], streak: null })),
    ]);
    const unlockedMap = new Map<string, string>(
      (myBadges as unknown as UnlockedRow[]).map((r) => [r.badge_id, r.unlocked_at]),
    );
    const badges: HistoryBadge[] = (badgesAll as unknown as BadgeRow[]).map((b) => ({
      code: b.code,
      icon: b.icon,
      title: (lang === "fr" ? b.title_fr : b.title_en) ?? b.title_fr,
      desc: (lang === "fr" ? b.desc_fr : b.desc_en) ?? b.desc_fr,
      unlocked: unlockedMap.has(b.id),
      unlockedAt: unlockedMap.get(b.id) ?? null,
    }));
    const completions = comp as unknown as CompletionsPayload;
    const lessonRows = lessons.map((l) => ({ title: l.title, completedAt: l.completed_at }));
    return {
      lang,
      displayName: profile?.display_name ?? null,
      stats: {
        streak: completions?.streak?.current_streak ?? 0,
        longest: completions?.streak?.longest_streak ?? 0,
        lessons: (completions?.completions ?? []).length,
        views: (views as unknown[]).length,
      },
      speech,
      pron,
      lessons: lessonRows,
      badges,
      include,
      labels: {
        reportTitle: t.historyReportTitle,
        exportedOn: t.exportedOn,
        summary: t.summary,
        streak: t.streak,
        longestStreak: t.longestStreak,
        lessonsCompleted: t.lessonsCompleted,
        contentsViewed: t.contentsViewed,
        timeline: t.activity,
        badges: t.myBadges,
        unlocked: t.unlocked,
        locked: t.locked,
        speaking: t.speaking,
        pronunciation: t.pronunciation,
        lesson: t.lesson,
        date: t.dateCol,
        type: t.typeCol,
        detail: t.detailCol,
        metric: t.metric,
        generatedBy: t.generatedBy,
        none: t.noneShort,
      },
    };
  }
}

function iconFor(kind: Kind) {
  const cls = "h-3 w-3 text-primary-foreground";
  if (kind === "speech") return <Mic className={cls} />;
  if (kind === "pron") return <LanguagesIcon className={cls} />;
  return <GraduationCap className={cls} />;
}

function dotClass(kind: Kind) {
  if (kind === "speech") return "bg-primary";
  if (kind === "pron") return "bg-accent";
  return "bg-foreground/70";
}

function ResumeBanner({
  pron,
  lesson,
  confidence,
  lessonTitle,
  t,
  lang,
}: {
  pron: PronResume | null;
  lesson: LessonResume | null;
  confidence: ConfidenceResume | null;
  lessonTitle: (id: string) => string;
  t: ReturnType<typeof useLang>["t"];
  lang: "fr" | "en";
}) {
  if (!pron && !lesson && !confidence) return null;
  const confKindLabel = (k: ConfidenceResume["kind"]) =>
    k === "breathing"
      ? t.confidenceBreathing
      : k === "articulation"
        ? t.confidenceArticulation
        : t.confidenceGuided;
  return (
    <div className="mb-5 space-y-2">
      <p className="text-[11px] uppercase tracking-wider text-accent">{t.resumeTitle}</p>
      {confidence && (
        <Link
          to="/explore/$slug"
          params={{ slug: confidence.slug }}
          className="group flex items-center justify-between gap-4 rounded-2xl border border-primary/40 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{t.resumeConfidence}</p>
              <p className="truncate text-xs text-muted-foreground">
                {confKindLabel(confidence.kind)} · {t.levels[confidence.level]}
                {confidence.focus ? ` · ${confidence.focus}` : ""} ·{" "}
                {new Date(confidence.savedAt).toLocaleString(lang)}
              </p>
              {confidence.title && (
                <p className="truncate text-xs text-foreground/80">{confidence.title}</p>
              )}
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-transform group-hover:translate-x-0.5">
            <PlayCircle className="h-3.5 w-3.5" />
            {t.resume}
          </span>
        </Link>
      )}
      {pron && (
        <Link
          to="/practice"
          search={{ lang: pron.lang as PracticeLang, level: pron.level, i: pron.index }}
          className="group flex items-center justify-between gap-4 rounded-2xl border border-accent/40 bg-accent/5 p-4 transition-colors hover:bg-accent/10"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <LanguagesIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{t.resumeExercise}</p>
              <p className="truncate text-xs text-muted-foreground">
                {pron.lang.toUpperCase()} · {t.levels[pron.level]} ·{" "}
                {new Date(pron.savedAt).toLocaleString(lang)}
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-transform group-hover:translate-x-0.5">
            <PlayCircle className="h-3.5 w-3.5" />
            {t.resume}
          </span>
        </Link>
      )}
      {lesson && (
        <Link
          to="/today"
          search={
            lesson.focus
              ? { focus: lesson.focus, lessonId: lesson.lessonId }
              : { lessonId: lesson.lessonId }
          }
          className="group flex items-center justify-between gap-4 rounded-2xl border border-primary/40 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <GraduationCap className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{t.resumeQuiz}</p>
              <p className="truncate text-xs text-muted-foreground">
                {lessonTitle(lesson.lessonId) || t.lesson} ·{" "}
                {new Date(lesson.savedAt).toLocaleString(lang)}
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-transform group-hover:translate-x-0.5">
            <PlayCircle className="h-3.5 w-3.5" />
            {t.resume}
          </span>
        </Link>
      )}
    </div>
  );
}
