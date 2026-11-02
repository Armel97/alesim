import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { AuthedNav } from "@/components/AuthedNav";
import {
  generateCoachingReport,
  getLatestCoachingReport,
  type CoachReport,
  type CoachExercise,
  type SkillProgression,
} from "@/lib/coach.functions";
import { loadSessions } from "@/lib/history-store";
import { loadPronunciationSessions } from "@/lib/pronunciation-history";
import { toast } from "sonner";
import {
  Sparkles,
  ArrowRight,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  RefreshCw,
  Wand2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/coach")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "ALESIM — Ton coach virtuel" },
      {
        name: "description",
        content: "Un plan d'entraînement personnalisé, basé sur tes tendances récentes.",
      },
      { property: "og:title", content: "ALESIM — Ton coach virtuel" },
      {
        property: "og:description",
        content: "Un plan d'entraînement personnalisé, basé sur tes tendances récentes.",
      },
    ],
  }),
  component: CoachPage,
});

function CoachPage() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [report, setReport] = useState<CoachReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState(true);
  const [localCount, setLocalCount] = useState(0);

  useEffect(() => {
    (async () => {
      const voice = loadSessions();
      const pron = loadPronunciationSessions();
      setLocalCount(voice.length + pron.length);
      try {
        const r = await getLatestCoachingReport();
        setReport(r);
      } catch {
        // ignore
      } finally {
        setInitial(false);
      }
    })();
  }, []);

  async function regenerate() {
    setLoading(true);
    try {
      const voice = loadSessions()
        .slice(0, 15)
        .map((s) => ({
          createdAt: s.createdAt,
          wpm: s.feedback?.wpm,
          clarity: s.feedback?.clarity,
          confidence: s.feedback?.confidence,
          fillerCount: s.feedback?.fillerCount,
          toneVariation: s.feedback?.toneVariation,
          durationSec: s.durationSec,
        }));
      const pron = loadPronunciationSessions()
        .slice(0, 15)
        .map((s) => ({
          createdAt: s.createdAt,
          accuracy: s.accuracy,
          fluency: s.fluency,
          passed: s.passed,
          fillerCount: s.fillerCount,
          pauseCount: s.pauseCount,
        }));
      const r = await generateCoachingReport({ data: { lang, voice, pronunciation: pron } });
      setReport(r);
      toast.success(lang === "fr" ? "Analyse mise à jour" : "Analysis updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function launchExercise(ex: CoachExercise) {
    if (ex.route === "practice") {
      navigate({ to: "/practice" });
    } else if (ex.route === "explore") {
      navigate({ to: "/explore" });
    } else {
      const focus =
        ex.focus === "pace"
          ? "pace"
          : ex.focus === "pronunciation" || ex.focus === "fluency"
            ? "pronunciation"
            : "confidence";
      navigate({ to: "/today", search: { focus } });
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AuthedNav />
      <main className="mx-auto w-full max-w-3xl space-y-6 px-6 pb-24">
        <header className="space-y-2">
          <p className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t.coach}
          </p>
          <h1 className="font-serif text-4xl leading-tight">{t.coachTitle}</h1>
          <p className="text-muted-foreground">{t.coachLead}</p>
        </header>

        {initial ? (
          <div className="rounded-3xl border bg-card p-8 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : !report ? (
          <EmptyState
            canGenerate={localCount >= 2}
            emptyText={t.coachEmpty}
            generateText={t.coachGenerate}
            onGenerate={regenerate}
            loading={loading}
            analyzingText={t.coachAnalyzing}
          />
        ) : (
          <ReportView
            report={report}
            onRegenerate={regenerate}
            onLaunch={launchExercise}
            loading={loading}
          />
        )}
      </main>
    </div>
  );
}

function EmptyState({
  canGenerate,
  emptyText,
  generateText,
  onGenerate,
  loading,
  analyzingText,
}: {
  canGenerate: boolean;
  emptyText: string;
  generateText: string;
  onGenerate: () => void;
  loading: boolean;
  analyzingText: string;
}) {
  return (
    <div className="rounded-3xl border bg-card p-8 text-center">
      <Wand2 className="mx-auto mb-3 h-6 w-6 text-primary" />
      <p className="mb-6 text-muted-foreground">{emptyText}</p>
      <button
        onClick={onGenerate}
        disabled={loading || !canGenerate}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? analyzingText : generateText}
      </button>
    </div>
  );
}

function ReportView({
  report,
  onRegenerate,
  onLaunch,
  loading,
}: {
  report: CoachReport;
  onRegenerate: () => void;
  onLaunch: (ex: CoachExercise) => void;
  loading: boolean;
}) {
  const { t, lang } = useLang();
  const skillLabel: Record<CoachReport["prioritySkill"], string> = {
    pace: t.coachSkillPace,
    fillers: t.coachSkillFillers,
    pronunciation: t.coachSkillPronunciation,
    fluency: t.coachSkillFluency,
    clarity: t.coachSkillClarity,
    confidence: t.coachSkillConfidence,
  };
  return (
    <div className="space-y-4">
      <section className="rounded-3xl border bg-gradient-to-br from-secondary/40 to-card p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.coachSummary}</p>
          <span className="text-xs text-muted-foreground">
            {report.metrics.sampleSize} {t.coachSampleSize}
          </span>
        </div>
        <p className="font-serif text-2xl leading-snug">{report.summary}</p>
        {report.progressNote && (
          <p className="mt-3 flex items-start gap-2 rounded-2xl bg-background/60 p-3 text-sm">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{report.progressNote}</span>
          </p>
        )}
      </section>

      <section className="rounded-3xl border bg-card p-6">
        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          {t.coachPriority}
        </p>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Target className="h-5 w-5" />
          </span>
          <p className="font-serif text-2xl">{skillLabel[report.prioritySkill]}</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(report.progression).map(([k, v]) =>
            v ? (
              <ProgressionTile
                key={k}
                skill={k}
                value={v}
                label={skillLabel[k as CoachReport["prioritySkill"]] ?? k}
              />
            ) : null,
          )}
        </div>
      </section>

      <section className="rounded-3xl border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.coachPlan}</p>
          <button
            onClick={onRegenerate}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {t.coachRegenerate}
          </button>
        </div>
        <ol className="space-y-3">
          {report.exercises.map((ex, i) => (
            <li key={i} className="rounded-2xl border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-serif text-lg">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">
                      {i + 1}
                    </span>
                    {ex.title}
                  </p>
                  {ex.why && <p className="mt-1 text-sm text-muted-foreground">{ex.why}</p>}
                  {ex.howto && <p className="mt-2 text-sm">{ex.howto}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">
                    ~{ex.durationMin} {lang === "fr" ? "min" : "min"} · {ex.focus}
                  </p>
                </div>
                <button
                  onClick={() => onLaunch(ex)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                >
                  {t.coachStartEx}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function ProgressionTile({
  skill,
  value,
  label,
}: {
  skill: string;
  value: SkillProgression;
  label: string;
}) {
  const { t } = useLang();
  // For fillers: negative delta is good.
  const good = skill === "fillers" ? value.delta < -0.5 : value.delta > 0.5;
  const bad = skill === "fillers" ? value.delta > 0.5 : value.delta < -0.5;
  const Icon = good ? TrendingUp : bad ? TrendingDown : Minus;
  const tone = good ? "text-emerald-600" : bad ? "text-rose-600" : "text-muted-foreground";
  const deltaText = good ? t.coachDeltaUp : bad ? t.coachDeltaDown : t.coachDeltaFlat;
  const sign = value.delta > 0 ? "+" : "";
  return (
    <div className="rounded-2xl border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-xl">
        {value.after}
        <span className="ml-1 text-xs text-muted-foreground">
          {value.unit === "wpm" ? "wpm" : value.unit === "count" ? "" : "/100"}
        </span>
      </p>
      <p className={`mt-1 inline-flex items-center gap-1 text-xs ${tone}`}>
        <Icon className="h-3 w-3" />
        {sign}
        {value.delta} · {deltaText}
      </p>
    </div>
  );
}
