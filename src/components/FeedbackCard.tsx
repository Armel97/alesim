import {
  Sparkles,
  TrendingUp,
  Leaf,
  ArrowRight,
  Heart,
  Gauge,
  MessageCircle,
  Music2,
  Dumbbell,
  Clock,
} from "lucide-react";
import type { FeedbackResult, TranscribedWord } from "@/lib/alesim.functions";
import { useLang } from "@/lib/i18n";
import { HesitationTranscript } from "@/components/HesitationTranscript";

export function FeedbackCard({
  transcript,
  durationSec,
  feedback,
  words: transcribedWords,
  audioUrl,
}: {
  transcript: string;
  durationSec: number;
  feedback: FeedbackResult;
  words?: TranscribedWord[];
  audioUrl?: string;
}) {
  const { t } = useLang();
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

  return (
    /* Bento apaisé : transcription à gauche, chiffres et encouragements à droite,
       trois tuiles colorées pour Débit / Clarté / Confiance. */
    <div className="space-y-5">
      {transcribedWords && transcribedWords.length > 0 && (
        <HesitationTranscript
          words={transcribedWords}
          durationSec={durationSec}
          audioUrl={audioUrl}
        />
      )}
      <div className="grid gap-5 md:grid-cols-5">
        <div className="md:col-span-2 rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            {t.transcript}
          </div>
          <p className="mt-4 font-serif text-2xl leading-snug text-foreground">
            &ldquo;{transcript}&rdquo;
          </p>
          <div className="mt-6 flex gap-6 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{wordCount}</span> {t.words}
            </span>
            <span>
              <span className="font-medium text-foreground">{durationSec.toFixed(1)}s</span>{" "}
              {t.duration.toLowerCase()}
            </span>
          </div>
        </div>

        <div className="md:col-span-3 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <SoftMetric tone="breathing" label={t.pace} value={`${feedback.wpm}`} sub={t.wpm} />
            <SoftMetric
              tone="communication"
              label={t.clarity}
              value={`${feedback.clarity}`}
              sub="/100"
            />
            <SoftMetric
              tone="confidence"
              label={t.confidence}
              value={`${feedback.confidence}`}
              sub="/100"
            />
          </div>

          <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Heart className="h-3.5 w-3.5 text-primary" />
                {t.feedback}
              </span>
              <span>
                {t.fillers}:{" "}
                <span className="font-medium text-foreground">{feedback.fillerCount}</span>
              </span>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              {feedback.strengths.length > 0 && (
                <Section icon={<Leaf className="h-4 w-4 text-primary" />} title={t.strengths}>
                  {feedback.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </Section>
              )}
              {feedback.improvements.length > 0 && (
                <Section
                  icon={<TrendingUp className="h-4 w-4 text-accent" />}
                  title={t.improvements}
                >
                  {feedback.improvements.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </Section>
              )}
            </div>

            {feedback.nextChallenge && (
              <div className="mt-5 rounded-2xl border border-accent/40 bg-accent/10 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-foreground/70">
                  <ArrowRight className="h-3.5 w-3.5 text-accent" />
                  {t.nextStep}
                </div>
                <p className="mt-2 font-serif text-lg leading-snug text-foreground">
                  {feedback.nextChallenge}
                </p>
              </div>
            )}
          </div>

          <DetailedCorrections feedback={feedback} />
          <TrainingPlan feedback={feedback} />
        </div>
      </div>
    </div>
  );
}

function TrainingPlan({ feedback }: { feedback: FeedbackResult }) {
  const { t } = useLang();
  const plan = feedback.trainingPlan;
  if (!plan || plan.length === 0) return null;
  return (
    <div className="rounded-3xl border border-primary/30 bg-primary/5 p-6 shadow-soft">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-foreground/70">
        <Dumbbell className="h-3.5 w-3.5 text-primary" />
        {t.trainingPlanTitle}
      </div>
      <p className="mt-2 text-sm text-foreground/80">{t.trainingPlanIntro}</p>
      <ol className="mt-4 space-y-3">
        {plan.map((e, i) => (
          <li key={i} className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-2xl leading-none text-primary">{i + 1}</span>
                <p className="font-serif text-lg leading-snug text-foreground">{e.title}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-foreground/70">
                <Clock className="h-3 w-3" />
                {e.durationMin} {t.trainingPlanMinutes}
              </span>
            </div>
            {e.why && (
              <p className="mt-2 text-sm text-foreground/80">
                <span className="font-medium text-foreground">{t.trainingPlanWhy} · </span>
                {e.why}
              </p>
            )}
            <p className="mt-1 text-sm text-foreground/80">
              <span className="font-medium text-foreground">{t.trainingPlanHow} · </span>
              {e.howto}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function DetailedCorrections({ feedback }: { feedback: FeedbackResult }) {
  const { t } = useLang();
  const hasFillers = (feedback.fillers?.length ?? 0) > 0;
  const hasLong = (feedback.longSentences?.length ?? 0) > 0;
  const hasPace = !!feedback.paceVerdict;
  const hasTone = typeof feedback.toneVariation === "number" || !!feedback.toneNote;
  if (!hasFillers && !hasLong && !hasPace && !hasTone) return null;

  const paceLabel =
    feedback.paceVerdict === "slow"
      ? t.paceSlow
      : feedback.paceVerdict === "fast"
        ? t.paceFast
        : t.paceIdeal;
  const paceTone =
    feedback.paceVerdict === "ideal"
      ? "border-primary/40 bg-primary/10"
      : "border-accent/40 bg-accent/10";

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        {t.detailedCorrections}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {hasPace && (
          <div className={`rounded-2xl border p-4 ${paceTone}`}>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-foreground/70">
              <Gauge className="h-3.5 w-3.5" />
              {paceLabel}
            </div>
            <p className="mt-2 text-sm text-foreground/85">
              {feedback.wpm} {t.wpm}
              {feedback.paceTarget && (
                <span className="text-muted-foreground">
                  {" · "}
                  {t.paceTargetLabel} {feedback.paceTarget.min}–{feedback.paceTarget.max}
                </span>
              )}
            </p>
            {feedback.paceNote && (
              <p className="mt-2 text-sm leading-relaxed text-foreground/80">{feedback.paceNote}</p>
            )}
          </div>
        )}

        {hasTone && (
          <div className="rounded-2xl border border-border/60 bg-secondary/40 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-foreground/70">
              <Music2 className="h-3.5 w-3.5" />
              {t.toneVariationLabel}
              {typeof feedback.toneVariation === "number" && (
                <span className="ml-auto font-medium text-foreground">
                  {feedback.toneVariation}/100
                </span>
              )}
            </div>
            {feedback.toneNote && (
              <p className="mt-2 text-sm leading-relaxed text-foreground/80">{feedback.toneNote}</p>
            )}
          </div>
        )}
      </div>

      {hasFillers && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <MessageCircle className="h-3.5 w-3.5 text-accent" />
            {t.fillersDetected}
          </div>
          <div className="flex flex-wrap gap-2">
            {feedback.fillers!.map((f) => (
              <span
                key={f.word}
                className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs text-foreground"
              >
                <span className="font-medium">{f.word}</span>
                <span className="text-muted-foreground">×{f.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {hasLong && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            {t.longSentencesTitle}
          </div>
          {feedback.longSentences!.map((s, i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-secondary/30 p-4">
              <p className="text-sm italic text-muted-foreground">&ldquo;{s.original}&rdquo;</p>
              {s.suggestion && (
                <div className="mt-2 rounded-xl bg-primary/10 p-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-foreground/70">
                    {t.reformulation}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">{s.suggestion}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SoftMetric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "breathing" | "communication" | "confidence";
}) {
  const toneClass = {
    breathing: "theme-breathing",
    communication: "theme-communication",
    confidence: "theme-confidence",
  }[tone];
  return (
    <div className={`${toneClass} rounded-3xl p-4 shadow-soft`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-80">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-serif text-3xl leading-none text-foreground">{value}</span>
        <span className="text-xs text-foreground/70">{sub}</span>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
        {icon}
        {title}
      </div>
      <ul className="space-y-1.5 pl-1 text-sm leading-relaxed text-foreground/85">{children}</ul>
    </div>
  );
}
