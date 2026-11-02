import { createFileRoute, Link } from "@tanstack/react-router";
import { bilingualLinks } from "@/lib/seo-lang";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { PronunciationRecorder } from "@/components/PronunciationRecorder";
import { useLang } from "@/lib/i18n";
import {
  LEVELS,
  PRACTICE_LANGS,
  sentencesFor,
  type Level,
  type PracticeLang,
} from "@/lib/language-content";
import { getProgress, isLevelUnlocked, markCompleted, totalXP } from "@/lib/language-progress";
import type { PronunciationResult, TranscribedWord } from "@/lib/languages.functions";
import { savePronunciationSession } from "@/lib/pronunciation-history";
import { practiceLocale, speakInLocale, localeLabel } from "@/lib/speech-locale";
import { computeHesitations, computeTimeline, timelineHesitationStats } from "@/lib/hesitations";
import { ArrowRight, CheckCircle2, Lock, RotateCcw, Trophy, Volume2 } from "lucide-react";
import { clearPronResume, setPronResume } from "@/lib/resume-store";

export const Route = createFileRoute("/practice")({
  component: Practice,
  validateSearch: (search: Record<string, unknown>) => {
    const lang = typeof search.lang === "string" ? (search.lang as PracticeLang) : undefined;
    const level =
      search.level === "beginner" || search.level === "intermediate" || search.level === "advanced"
        ? (search.level as Level)
        : undefined;
    const i =
      typeof search.i === "string" || typeof search.i === "number" ? Number(search.i) : undefined;
    const hl = search.hl === "fr" || search.hl === "en" ? (search.hl as "fr" | "en") : undefined;
    return {
      ...(lang ? { lang } : {}),
      ...(level ? { level } : {}),
      ...(Number.isFinite(i) ? { i } : {}),
      ...(hl ? { hl } : {}),
    } as { lang?: PracticeLang; level?: Level; i?: number; hl?: "fr" | "en" };
  },
  head: () => ({
    meta: [
      { title: "ALESIM — Entraînement oral en langue étrangère" },
      {
        name: "description",
        content:
          "Progressez à l'oral en anglais, espagnol, allemand, italien et portugais avec un coach IA qui corrige votre prononciation.",
      },
      { property: "og:title", content: "Entraînement oral en langue étrangère — ALESIM" },
      {
        property: "og:description",
        content:
          "Progressez à l'oral en anglais, espagnol, allemand, italien et portugais avec un coach IA qui corrige votre prononciation.",
      },
      { name: "twitter:title", content: "Entraînement oral en langue étrangère — ALESIM" },
      {
        name: "twitter:description",
        content:
          "Progressez à l'oral en anglais, espagnol, allemand, italien et portugais avec un coach IA qui corrige votre prononciation.",
      },
      { property: "og:url", content: "https://alesimspeak.dev/practice" },
      { property: "og:image", content: "https://alesimspeak.dev/og-alesim-practice.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "ALESIM — module bonus de prononciation en langue étrangère",
      },
      { name: "twitter:image", content: "https://alesimspeak.dev/og-alesim-practice.jpg" },
    ],
    links: bilingualLinks("/practice"),
  }),
});

function Practice() {
  const { t, lang: uiLang } = useLang();
  const search = Route.useSearch();
  const [target, setTarget] = useState<PracticeLang>(search.lang ?? "en");
  const [level, setLevel] = useState<Level>(search.level ?? "beginner");
  const [index, setIndex] = useState(search.i ?? 0);
  const [result, setResult] = useState<{
    transcript: string;
    result: PronunciationResult;
    durationSec: number;
    words: TranscribedWord[];
    apiDurationSec?: number;
  } | null>(null);
  const [tick, setTick] = useState(0);

  const sentences = useMemo(() => sentencesFor(target, level), [target, level]);
  const progress = useMemo(
    () => getProgress(target, level),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target, level, tick],
  );
  const xp = useMemo(() => totalXP(target), [target, tick]);

  useEffect(() => {
    const p = getProgress(target, level);
    // Prefer explicit ?i= only for the very first render; afterwards pick next incomplete.
    const forced = typeof search.i === "number" ? search.i : null;
    if (forced !== null && !p.completed.includes(forced) && forced < sentences.length) {
      setIndex(forced);
    } else {
      const next = sentences.findIndex((_, i) => !p.completed.includes(i));
      setIndex(next === -1 ? 0 : next);
    }
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, level, sentences]);

  // Persist / clear a resume marker whenever level state changes.
  useEffect(() => {
    const p = getProgress(target, level);
    const done = p.completed.length >= sentences.length;
    if (done) {
      clearPronResume();
    } else {
      setPronResume({
        lang: target,
        level,
        index,
        savedAt: Date.now(),
      });
    }
  }, [target, level, index, sentences.length, tick]);

  const speak = () => {
    speakInLocale(sentences[index], practiceLocale(target), 0.9);
  };

  const onDone = (r: {
    transcript: string;
    result: PronunciationResult;
    durationSec: number;
    words: TranscribedWord[];
    apiDurationSec?: number;
  }) => {
    setResult(r);
    const trueDuration = r.apiDurationSec ?? r.durationSec;
    const timeline = computeTimeline(r.words, trueDuration, target);
    const h = timeline.length
      ? timelineHesitationStats(timeline, trueDuration)
      : computeHesitations(r.transcript, r.durationSec, target);
    savePronunciationSession({
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      lang: target,
      level,
      reference: sentences[index],
      transcript: r.transcript,
      accuracy: r.result.accuracy,
      fluency: r.result.fluency,
      passed: r.result.passed,
      durationSec: h.durationSec,
      fillerCount: h.fillerCount,
      pauseCount: h.pauseCount,
      pauseSec: h.pauseSec,
      timeline,
    });
    if (r.result.passed) {
      markCompleted(target, level, index);
      setTick((n) => n + 1);
    }
  };

  const goNext = () => {
    setResult(null);
    if (index + 1 < sentences.length) setIndex(index + 1);
  };
  const retry = () => setResult(null);

  const levelDone = progress.completed.length >= sentences.length;

  return (
    <main className="min-h-dvh bg-background">
      <AppHeader />
      <section className="mx-auto w-full max-w-5xl px-6 pb-24">
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[oklch(0.55_0.12_255)]">
              {t.practiceKicker}
            </p>
            <span className="inline-flex items-center rounded-full border border-[oklch(0.55_0.12_255)]/40 bg-[oklch(0.55_0.12_255)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[oklch(0.45_0.12_255)]">
              {t.bonusBadge}
            </span>
          </div>
          <h1 className="mt-3 font-serif text-5xl leading-tight text-foreground md:text-6xl">
            {t.practiceTitle}
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">{t.practiceLead}</p>
          <div className="mt-6 rounded-2xl border border-[oklch(0.55_0.12_255)]/30 bg-[oklch(0.55_0.12_255)]/8 px-5 py-4 text-sm leading-relaxed text-foreground">
            {t.practiceBanner}{" "}
            <Link
              to="/today"
              className="font-semibold text-[oklch(0.45_0.12_255)] underline underline-offset-4"
            >
              {t.practiceBannerCta}
            </Link>
            .
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {PRACTICE_LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setTarget(l.code)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                target === l.code
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-foreground hover:border-foreground/40"
              }`}
            >
              <span className="text-base">{l.flag}</span>
              {uiLang === "fr" ? l.labelFr : l.labelEn}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex rounded-full border bg-card p-1 text-sm">
            {LEVELS.map((lv) => {
              const unlocked = isLevelUnlocked(target, lv, sentences.length);
              const active = level === lv;
              return (
                <button
                  key={lv}
                  type="button"
                  onClick={() => unlocked && setLevel(lv)}
                  disabled={!unlocked}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : unlocked
                        ? "text-muted-foreground hover:text-foreground"
                        : "text-muted-foreground/50 cursor-not-allowed"
                  }`}
                >
                  {!unlocked && <Lock className="h-3.5 w-3.5" />}
                  {t.levels[lv]}
                </button>
              );
            })}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm text-foreground">
            <Trophy className="h-4 w-4 text-accent" />
            {xp} XP
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {t.progress} · {progress.completed.length}/{sentences.length}
            </span>
            <span>{t.levels[level]}</span>
          </div>
          <div className="mt-2 flex gap-1.5">
            {sentences.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  progress.completed.includes(i)
                    ? "bg-accent"
                    : i === index
                      ? "bg-foreground/40"
                      : "bg-border"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-[2rem] bg-gradient-warm p-8 shadow-soft md:p-12">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-foreground/60">
            <span>
              {t.sentence} {index + 1}/{sentences.length}
            </span>
            <button
              type="button"
              onClick={speak}
              aria-label={`${t.listen} (${localeLabel(practiceLocale(target))})`}
              className="inline-flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1.5 text-foreground backdrop-blur transition-colors hover:bg-background"
            >
              <Volume2 className="h-3.5 w-3.5" />
              {t.listen}
              <span className="text-[10px] font-semibold tracking-wider text-foreground/60">
                {localeLabel(practiceLocale(target))}
              </span>
            </button>
          </div>
          <p className="mt-6 font-serif text-3xl leading-snug text-foreground md:text-4xl">
            &ldquo;{sentences[index]}&rdquo;
          </p>

          <div className="mt-10 flex justify-center">
            <PronunciationRecorder
              key={`${target}-${level}-${index}`}
              reference={sentences[index]}
              targetLang={target}
              onDone={onDone}
            />
          </div>
        </div>

        {result && (
          <div className="mt-8 space-y-6 rounded-[2rem] border bg-card p-8 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {result.result.passed ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1.5 text-sm font-medium text-accent">
                    <CheckCircle2 className="h-4 w-4" />
                    {t.passed}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-foreground">
                    {t.tryAgain}
                  </span>
                )}
              </div>
              <div className="flex gap-6 text-sm">
                <Metric label={t.accuracy} value={result.result.accuracy} />
                <Metric label={t.fluency} value={result.result.fluency} />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                {t.wordByWord}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.result.words.map((w, i) => (
                  <span
                    key={i}
                    title={w.hint}
                    className={`rounded-md px-2 py-1 text-sm ${
                      w.ok
                        ? "bg-accent/10 text-foreground"
                        : "bg-destructive/10 text-destructive underline decoration-dotted"
                    }`}
                  >
                    {w.word}
                    {!w.ok && w.hint && (
                      <span className="ml-1 text-xs text-muted-foreground">→ {w.hint}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                {t.heard}
              </p>
              <p className="italic text-muted-foreground">&ldquo;{result.transcript}&rdquo;</p>
            </div>

            {result.result.phoneticTip && (
              <div className="rounded-2xl bg-secondary p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t.phoneticTip}
                </p>
                <p className="mt-1 text-foreground">{result.result.phoneticTip}</p>
              </div>
            )}

            {result.result.advice.length > 0 && (
              <ul className="space-y-1.5 text-sm text-foreground">
                {result.result.advice.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-accent">•</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            )}

            {typeof result.result.nativeProximity === "number" && (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
                  <span>{t.nativeProximity}</span>
                  <span className="font-medium text-foreground">
                    {result.result.nativeProximity}/100
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${result.result.nativeProximity}%` }}
                  />
                </div>
              </div>
            )}

            {result.result.phonemeIssues && result.result.phonemeIssues.length > 0 && (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                  {t.phonemeIssuesTitle}
                </p>
                <div className="space-y-2">
                  {result.result.phonemeIssues.map((p, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-border bg-secondary/40 p-3 text-sm"
                    >
                      <span className="font-medium text-foreground">{p.word}</span>
                      {p.phoneme && (
                        <span className="ml-2 rounded bg-background px-1.5 py-0.5 font-mono text-xs text-accent">
                          {p.phoneme}
                        </span>
                      )}
                      <p className="mt-1 text-foreground/80">{p.tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.result.grammarIssues && result.result.grammarIssues.length > 0 && (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                  {t.grammarIssuesTitle}
                </p>
                <div className="space-y-2">
                  {result.result.grammarIssues.map((g, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-border bg-secondary/40 p-3 text-sm"
                    >
                      <p className="italic text-muted-foreground line-through">{g.issue}</p>
                      <p className="mt-1 text-foreground">{g.correction}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.result.trainingPlan && result.result.trainingPlan.length > 0 && (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t.trainingPlanTitle}
                </p>
                <p className="mt-1 text-sm text-foreground/80">{t.trainingPlanIntro}</p>
                <ol className="mt-3 space-y-2">
                  {result.result.trainingPlan.map((e, i) => (
                    <li key={i} className="rounded-xl border border-border bg-card p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-foreground">
                          <span className="mr-2 text-primary">{i + 1}.</span>
                          {e.title}
                        </p>
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-foreground/70">
                          {e.durationMin} {t.trainingPlanMinutes}
                        </span>
                      </div>
                      {e.why && (
                        <p className="mt-1 text-foreground/80">
                          <span className="font-medium text-foreground">
                            {t.trainingPlanWhy} ·{" "}
                          </span>
                          {e.why}
                        </p>
                      )}
                      <p className="mt-1 text-foreground/80">
                        <span className="font-medium text-foreground">{t.trainingPlanHow} · </span>
                        {e.howto}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={retry}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-foreground/40"
              >
                <RotateCcw className="h-4 w-4" />
                {t.tryAgain}
              </button>
              {result.result.passed && index + 1 < sentences.length && (
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
                >
                  {t.nextSentence}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
              {result.result.passed && levelDone && (
                <div className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-4 py-2.5 text-sm font-medium text-accent">
                  <Trophy className="h-4 w-4" />
                  {t.levelComplete}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-serif text-3xl text-foreground tabular-nums">{value}</div>
    </div>
  );
}
