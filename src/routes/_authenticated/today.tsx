import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/i18n";
import { getMyProfile } from "@/lib/onboarding.functions";
import {
  listLessons,
  completeLesson,
  getMyCompletions,
  getMyThemeMastery,
  type ThemeMastery,
} from "@/lib/lessons.functions";
import { transcribeAudio, analyzeSpeech } from "@/lib/alesim.functions";
import { PushToggle } from "@/components/PushToggle";
import { startRecorder, type RecorderHandle } from "@/lib/audio-recorder";
import { AudioConsentDeniedError } from "@/lib/audio-consent";
import { toast } from "sonner";
import {
  Mic,
  Square,
  Check,
  Flame,
  Compass,
  Languages as LanguagesIcon,
  ArrowRight,
  Sparkles,
  Target,
  Wind,
  Gauge,
  Info,
} from "lucide-react";
import { AuthedNav } from "@/components/AuthedNav";
import { QuizPanel } from "@/components/QuizPanel";
import { CelebrationModal } from "@/components/CelebrationModal";
import type { UnlockedBadge } from "@/lib/badges.server";
import { clearLessonResume, setLessonResume } from "@/lib/resume-store";

export const Route = createFileRoute("/_authenticated/today")({
  validateSearch: (search: Record<string, unknown>) => {
    const focus =
      search.focus === "confidence" || search.focus === "pace" || search.focus === "pronunciation"
        ? (search.focus as "confidence" | "pace" | "pronunciation")
        : undefined;
    const lessonId = typeof search.lessonId === "string" ? search.lessonId : undefined;
    const hl = search.hl === "fr" || search.hl === "en" ? (search.hl as "fr" | "en") : undefined;
    return {
      ...(focus ? { focus } : {}),
      ...(lessonId ? { lessonId } : {}),
      ...(hl ? { hl } : {}),
    } as {
      focus?: "confidence" | "pace" | "pronunciation";
      lessonId?: string;
      hl?: "fr" | "en";
    };
  },
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "ALESIM — Aujourd'hui" },
      {
        name: "description",
        content:
          "Votre leçon vocale du jour avec ALESIM : exercice ciblé, retour IA immédiat et suivi de votre streak pour progresser à l'oral en quelques minutes.",
      },
      { property: "og:title", content: "ALESIM — Aujourd'hui" },
      {
        property: "og:description",
        content:
          "Votre leçon vocale du jour avec ALESIM : exercice ciblé, retour IA immédiat et suivi de votre streak pour progresser à l'oral.",
      },
      { property: "og:url", content: "https://alesimspeak.dev/today" },
    ],
    links: [{ rel: "canonical", href: "https://alesimspeak.dev/today" }],
  }),
  component: TodayPage,
});

type Lesson = {
  id: string;
  slug: string;
  theme: string;
  order_index: number;
  title_fr: string;
  title_en: string;
  content_fr: string;
  content_en: string;
  exercise_prompt_fr: string;
  exercise_prompt_en: string;
  target_seconds: number;
};

type Focus = "confidence" | "pace" | "pronunciation";
const FOCUS_TO_THEME: Record<Focus, string> = {
  confidence: "confidence",
  pace: "breathing",
  pronunciation: "articulation",
};
const GOAL_TO_FOCUS: Record<string, Focus> = {
  interview: "confidence",
  public: "confidence",
  stutter: "pace",
  language: "pronunciation",
};
const FOCUS_KEY = "alesim:today-focus:v1";

function focusLabel(f: Focus, lang: "fr" | "en"): string {
  if (lang === "fr")
    return f === "confidence" ? "Confiance" : f === "pace" ? "Débit" : "Prononciation";
  return f === "confidence" ? "Confidence" : f === "pace" ? "Pace" : "Pronunciation";
}
function themeLabelStatic(theme: string, lang: "fr" | "en"): string {
  if (lang === "fr")
    return theme === "breathing"
      ? "respiration"
      : theme === "articulation"
        ? "articulation"
        : "confiance";
  return theme === "breathing"
    ? "breathing"
    : theme === "articulation"
      ? "articulation"
      : "confidence";
}

function TodayPage() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{
    onboarding_completed: boolean;
    reminder_hour_utc?: number;
    goal?: string;
  } | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState(0);
  const [mastery, setMastery] = useState<ThemeMastery[]>([]);
  const [focus, setFocus] = useState<Focus | null>(null);

  const [recording, setRecording] = useState(false);
  const [rec, setRec] = useState<RecorderHandle | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<{
    wpm: number;
    transcript: string;
    feedback: string;
  } | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [pendingComplete, setPendingComplete] = useState<null | {
    wpm: number;
    durationSec: number;
    transcript: string;
    summary: string;
  }>(null);
  const [newBadges, setNewBadges] = useState<UnlockedBadge[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [p, ls, c, m] = await Promise.all([
          getMyProfile(),
          listLessons(),
          getMyCompletions(),
          getMyThemeMastery().catch(() => [] as ThemeMastery[]),
        ]);
        if (!p?.onboarding_completed) {
          navigate({ to: "/onboarding" });
          return;
        }
        const prof = p as {
          onboarding_completed: boolean;
          reminder_hour_utc?: number;
          goal?: string;
        };
        setProfile(prof);
        setLessons(ls as Lesson[]);
        setCompletedIds(new Set((c.completions ?? []).map((x) => x.lesson_id)));
        setStreak(c.streak?.current_streak ?? 0);
        setMastery(m);
        const stored =
          typeof window !== "undefined" ? (localStorage.getItem(FOCUS_KEY) as Focus | null) : null;
        const goalFocus = prof.goal ? GOAL_TO_FOCUS[prof.goal] : undefined;
        const initial = search.focus ?? stored ?? goalFocus ?? "confidence";
        setFocus(initial);
        if (search.focus) {
          try {
            localStorage.setItem(FOCUS_KEY, search.focus);
          } catch (_) {
            void 0;
          }
        }
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, search.focus]);

  function chooseFocus(f: Focus) {
    setFocus(f);
    try {
      localStorage.setItem(FOCUS_KEY, f);
    } catch (_) {
      void 0;
    }
  }

  const targetTheme = focus ? FOCUS_TO_THEME[focus] : null;
  const masteryByTheme = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of mastery) m.set(row.theme, row.mastery);
    return m;
  }, [mastery]);

  const { lessonOfDay, reasons } = useMemo<{
    lessonOfDay: Lesson | null;
    reasons: string[];
  }>(() => {
    if (lessons.length === 0) return { lessonOfDay: null, reasons: [] };
    const remaining = lessons.filter((l) => !completedIds.has(l.id));
    if (remaining.length === 0) return { lessonOfDay: null, reasons: [] };
    const scored = remaining.map((l) => {
      const themeMatch = targetTheme && l.theme === targetTheme ? 1 : 0;
      const themeMastery = masteryByTheme.get(l.theme) ?? 0.5;
      const weakBoost = 1 - themeMastery;
      const orderPenalty = l.order_index * 0.001;
      return {
        lesson: l,
        score: themeMatch * 2 + weakBoost * 0.8 - orderPenalty,
        themeMatch,
        themeMastery,
      };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    const r: string[] = [];
    if (best.themeMatch && focus) {
      r.push(
        lang === "fr"
          ? `Correspond à votre focus « ${focusLabel(focus, "fr")} » (thème ${themeLabelStatic(best.lesson.theme, "fr")}).`
          : `Matches your focus "${focusLabel(focus, "en")}" (${themeLabelStatic(best.lesson.theme, "en")} theme).`,
      );
    } else if (focus) {
      r.push(
        lang === "fr"
          ? `Aucune leçon restante sur « ${focusLabel(focus, "fr")} » — thème proche proposé.`
          : `No remaining lesson on "${focusLabel(focus, "en")}" — nearby theme suggested.`,
      );
    }
    if (best.themeMastery < 0.5) {
      r.push(
        lang === "fr"
          ? `Thème encore peu maîtrisé (${Math.round(best.themeMastery * 100)}%) — priorité renforcée.`
          : `Theme below goal (${Math.round(best.themeMastery * 100)}%) — extra priority.`,
      );
    } else {
      r.push(
        lang === "fr"
          ? `Maîtrise du thème : ${Math.round(best.themeMastery * 100)}% — consolidation.`
          : `Theme mastery: ${Math.round(best.themeMastery * 100)}% — consolidating.`,
      );
    }
    if (profile?.goal && GOAL_TO_FOCUS[profile.goal] && focus === GOAL_TO_FOCUS[profile.goal]) {
      r.push(
        lang === "fr"
          ? "Aligné avec l'objectif choisi à l'onboarding."
          : "Aligned with the goal set during onboarding.",
      );
    }
    r.push(
      lang === "fr"
        ? `Durée estimée ≈ ${Math.max(1, Math.round(best.lesson.target_seconds / 60))} min.`
        : `Estimated duration ≈ ${Math.max(1, Math.round(best.lesson.target_seconds / 60))} min.`,
    );
    return { lessonOfDay: best.lesson, reasons: r };
  }, [lessons, completedIds, targetTheme, masteryByTheme, focus, lang, profile]);

  const title = (l: Lesson) => (lang === "fr" ? l.title_fr : l.title_en);
  const content = (l: Lesson) => (lang === "fr" ? l.content_fr : l.content_en);
  const prompt = (l: Lesson) => (lang === "fr" ? l.exercise_prompt_fr : l.exercise_prompt_en);
  const themeLabel = (theme: string) =>
    theme === "breathing"
      ? t.themeBreathing
      : theme === "articulation"
        ? t.themeArticulation
        : t.themeConfidence;

  async function startMic() {
    try {
      const r = await startRecorder("today-lesson");
      setRec(r);
      setStartedAt(Date.now());
      setRecording(true);
    } catch (err) {
      if (err instanceof AudioConsentDeniedError) {
        toast.error(
          lang === "en"
            ? "Microphone declined: read the lesson out loud, then mark it as done without analysis."
            : "Micro refusé : lisez la leçon à voix haute, puis validez-la sans analyse.",
        );
        return;
      }
      toast.error(t.micDenied);
    }
  }

  async function stopMic() {
    if (!rec || !lessonOfDay) return;
    setRecording(false);
    setAnalyzing(true);
    try {
      const blob = await rec.stop();
      const durationSec = Math.max(0.5, (Date.now() - startedAt) / 1000);
      const b64 = await blobToBase64(blob);
      const { text } = await transcribeAudio({
        data: { audioBase64: b64, mimeType: "audio/wav", lang },
      });
      const feedback = await analyzeSpeech({
        data: { transcript: text, durationSec, lang, prompt: prompt(lessonOfDay) },
      });
      const summary = [
        `${feedback.wpm} ${t.wpm}`,
        ...(feedback.strengths[0] ? [feedback.strengths[0]] : []),
        ...(feedback.nextChallenge ? [feedback.nextChallenge] : []),
      ].join(" · ");
      setResult({ wpm: feedback.wpm, transcript: text, feedback: summary });
      setPendingComplete({
        wpm: feedback.wpm,
        durationSec: Math.round(durationSec),
        transcript: text,
        summary,
      });
      setQuizOpen(true);
      // Remember this lesson so the user can resume the quiz if interrupted.
      if (lessonOfDay) {
        setLessonResume({
          lessonId: lessonOfDay.id,
          focus: focus ?? null,
          phase: "quiz",
          savedAt: Date.now(),
        });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAnalyzing(false);
      setRec(null);
    }
  }

  async function finalizeLesson(quizScore?: number, quizTotal?: number) {
    if (!lessonOfDay || !pendingComplete) return;
    try {
      const res = await completeLesson({
        data: {
          lessonId: lessonOfDay.id,
          wpm: pendingComplete.wpm,
          durationSec: pendingComplete.durationSec,
          transcript: pendingComplete.transcript,
          feedback: pendingComplete.summary,
          quizScore,
          quizTotal,
        },
      });
      setCompletedIds((s) => new Set([...s, lessonOfDay.id]));
      setStreak(res.currentStreak);
      if (res.newBadges?.length) setNewBadges(res.newBadges);
      clearLessonResume();
      toast.success(t.lessonDone);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        {t.analyzing}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AuthedNav streak={streak} />

      <main className="mx-auto w-full max-w-2xl px-6 pb-16">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{t.today}</p>
        <h1 className="mt-2 font-serif text-4xl">{t.lessonOfDay}</h1>

        <BentoDashboard
          lang={lang}
          streak={streak}
          completed={completedIds.size}
          total={lessons.length}
        />

        <FocusPicker lang={lang} focus={focus} onChange={chooseFocus} />

        {!lessonOfDay ? (
          <div className="mt-8 rounded-2xl border bg-card p-8 text-center">
            <Check className="mx-auto h-10 w-10 text-primary" />
            <p className="mt-4 text-muted-foreground">{t.noLessonToday}</p>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border bg-card p-8">
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs">
                {themeLabel(lessonOfDay.theme)}
              </span>
              <h2 className="mt-3 font-serif text-2xl">{title(lessonOfDay)}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {content(lessonOfDay)}
              </p>
            </div>

            <WhyThisLesson lang={lang} reasons={reasons} />

            <div className="rounded-2xl border bg-card p-8 text-center">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {t.doExercise}
              </p>
              <p className="mt-2 font-serif text-lg">{prompt(lessonOfDay)}</p>
              <button
                onClick={recording ? stopMic : startMic}
                disabled={analyzing || !!result}
                aria-label={
                  recording
                    ? lang === "fr"
                      ? "Arrêter l'enregistrement"
                      : "Stop recording"
                    : lang === "fr"
                      ? "Commencer l'enregistrement"
                      : "Start recording"
                }
                className="mx-auto mt-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
              >
                {analyzing ? (
                  <span className="text-xs px-2">{t.analyzing}</span>
                ) : result ? (
                  <Check className="h-8 w-8" />
                ) : recording ? (
                  <Square className="h-8 w-8" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </button>
              {result && (
                <div className="mt-6 rounded-xl bg-secondary p-4 text-left">
                  <p className="text-xs uppercase text-muted-foreground">{t.feedback}</p>
                  <p className="mt-2 text-sm">{result.feedback}</p>
                  <p className="mt-3 text-xs text-muted-foreground">"{result.transcript}"</p>
                  <p className="mt-4 text-sm text-primary">{t.encouragement}</p>
                </div>
              )}
            </div>

            {quizOpen && (
              <div>
                <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                  {t.quiz}
                </p>
                <QuizPanel
                  lessonId={lessonOfDay.id}
                  onDone={(score, total) => {
                    finalizeLesson(score, total);
                    setQuizOpen(false);
                  }}
                  onSkip={() => {
                    finalizeLesson();
                    setQuizOpen(false);
                  }}
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
            {t.notifications}
          </p>
          <PushToggle initialHourUtc={profile?.reminder_hour_utc ?? 17} />
        </div>
      </main>
      <CelebrationModal badges={newBadges} onClose={() => setNewBadges([])} />
    </div>
  );
}

function BentoDashboard({
  lang,
  streak,
  completed,
  total,
}: {
  lang: "fr" | "en";
  streak: number;
  completed: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const L =
    lang === "fr"
      ? {
          streak: "Série en cours",
          days: streak > 1 ? "jours" : "jour",
          progress: "Progression globale",
          completedLabel: "leçons terminées",
          record: "Enregistrer",
          recordDesc: "Lancer une séance vocale",
          explore: "Explorer",
          exploreDesc: "Contenus courts par thème",
          practice: "Langues",
          practiceDesc: "Prononciation guidée",
        }
      : {
          streak: "Current streak",
          days: streak > 1 ? "days" : "day",
          progress: "Overall progress",
          completedLabel: "lessons completed",
          record: "Record",
          recordDesc: "Start a voice session",
          explore: "Explore",
          exploreDesc: "Short pieces by theme",
          practice: "Languages",
          practiceDesc: "Guided pronunciation",
        };

  return (
    <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className="col-span-2 rounded-3xl border bg-gradient-to-br from-primary/15 to-accent/10 p-5 md:col-span-2 md:row-span-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <Flame className="h-3.5 w-3.5 text-primary" />
          {L.streak}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-serif text-6xl leading-none text-foreground">{streak}</span>
          <span className="text-sm text-muted-foreground">{L.days}</span>
        </div>
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              {L.progress}
            </span>
            <span>
              {completed}/{total} · {pct}%
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-background/60">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {completed} {L.completedLabel}
          </p>
        </div>
      </div>

      <QuickCard
        to="/explore"
        icon={<Compass className="h-4 w-4" />}
        title={L.explore}
        desc={L.exploreDesc}
      />
      <QuickCard
        to="/practice"
        icon={<LanguagesIcon className="h-4 w-4" />}
        title={L.practice}
        desc={L.practiceDesc}
      />
      <QuickCard
        to="/history"
        icon={<Mic className="h-4 w-4" />}
        title={L.record}
        desc={L.recordDesc}
      />
      <QuickCard
        to="/dashboard"
        icon={<Sparkles className="h-4 w-4" />}
        title={lang === "fr" ? "Statistiques" : "Stats"}
        desc={lang === "fr" ? "Vos métriques détaillées" : "Your detailed metrics"}
      />
    </section>
  );
}

function QuickCard({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col justify-between rounded-3xl border bg-card p-4 shadow-soft transition-colors hover:bg-secondary/50"
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="font-serif text-base leading-tight text-foreground">{desc}</p>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function FocusPicker({
  lang,
  focus,
  onChange,
}: {
  lang: "fr" | "en";
  focus: Focus | null;
  onChange: (f: Focus) => void;
}) {
  const L =
    lang === "fr"
      ? { title: "Focus du jour", hint: "Adaptez la leçon à ce que vous voulez travailler." }
      : { title: "Today's focus", hint: "Tune the lesson to what you want to work on." };
  const options: { key: Focus; icon: React.ReactNode; label: string; desc: string }[] = [
    {
      key: "confidence",
      icon: <Target className="h-4 w-4" />,
      label: focusLabel("confidence", lang),
      desc: lang === "fr" ? "Assurance et posture" : "Poise and delivery",
    },
    {
      key: "pace",
      icon: <Gauge className="h-4 w-4" />,
      label: focusLabel("pace", lang),
      desc: lang === "fr" ? "Débit et respiration" : "Pace and breathing",
    },
    {
      key: "pronunciation",
      icon: <Wind className="h-4 w-4" />,
      label: focusLabel("pronunciation", lang),
      desc: lang === "fr" ? "Articulation, clarté" : "Articulation, clarity",
    },
  ];
  return (
    <section className="mt-6 rounded-3xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{L.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{L.hint}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {options.map((o) => {
          const active = focus === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onChange(o.key)}
              className={`flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-colors ${
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background/60 hover:bg-secondary/50"
              }`}
            >
              <span
                className={`inline-flex items-center gap-1.5 text-xs uppercase tracking-widest ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                {o.icon}
                {o.label}
              </span>
              <span className="font-serif text-sm leading-tight text-foreground">{o.desc}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function WhyThisLesson({ lang, reasons }: { lang: "fr" | "en"; reasons: string[] }) {
  if (reasons.length === 0) return null;
  const title = lang === "fr" ? "Pourquoi cette leçon ?" : "Why this lesson?";
  return (
    <div className="rounded-2xl border bg-secondary/40 p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Info className="h-3.5 w-3.5 text-primary" />
        {title}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm text-foreground">
        {reasons.map((r, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
