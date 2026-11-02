import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  CircleDashed,
  History as HistoryIcon,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AuthedNav } from "@/components/AuthedNav";
import { InterviewRecorder, type InterviewTake } from "@/components/InterviewRecorder";
import {
  VideoMetricsPanel,
  VideoMetricChips,
  type VideoMetricValues,
} from "@/components/VideoMetricsPanel";
import { useLang } from "@/lib/i18n";
import { transcribeAudio } from "@/lib/alesim.functions";
import { analyzeHesitations } from "@/lib/hesitation-analysis";
import {
  analyzeStarResponse,
  deleteInterviewResponse,
  generateInterviewQuestions,
  generateStarExample,
  listInterviewHistory,
  type FormMetrics,
  type InterviewDifficulty,
  type InterviewFormat,
  type InterviewQuestion,
  type InterviewType,
  type StarAnalysis,
  type StarPart,
} from "@/lib/interview.functions";

export const Route = createFileRoute("/_authenticated/interview")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Simulation d'entretien — ALESIM" },
      {
        name: "description",
        content:
          "Entraîne-toi aux questions d'entretien et structure tes réponses avec la méthode STAR, avec un feedback bienveillant sur le fond et la forme.",
      },
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: "ALESIM — Simulation d'entretien" },
      {
        property: "og:description",
        content:
          "Questions d'entretien générées sur mesure et analyse STAR de tes réponses, audio ou vidéo.",
      },
    ],
  }),
  component: InterviewPage,
});

type Screen = "config" | "run" | "result" | "history";

type Analysis = {
  responseId: string;
  transcript: string;
  star: StarAnalysis;
  form: FormMetrics;
  mediaUrl: string;
  withVideo: boolean;
};

function InterviewPage() {
  const { lang } = useLang();
  const fr = lang === "fr";
  const [screen, setScreen] = useState<Screen>("config");

  // config
  const [interviewType, setInterviewType] = useState<InterviewType>("rh");
  const [targetRole, setTargetRole] = useState("");
  const [sector, setSector] = useState("");
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>("standard");
  const [format, setFormat] = useState<InterviewFormat>("audio");
  const [immersive, setImmersive] = useState(false);
  const [generating, setGenerating] = useState(false);

  // simulation
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [showGuide, setShowGuide] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [example, setExample] = useState<string | null>(null);
  const [exampleLoading, setExampleLoading] = useState(false);

  const [history, setHistory] = useState<Awaited<ReturnType<typeof listInterviewHistory>>>([]);

  const genQuestions = useServerFn(generateInterviewQuestions);
  const transcribe = useServerFn(transcribeAudio);
  const analyzeStar = useServerFn(analyzeStarResponse);
  const genExample = useServerFn(generateStarExample);
  const loadHistory = useServerFn(listInterviewHistory);
  const removeResponse = useServerFn(deleteInterviewResponse);

  useEffect(() => {
    loadHistory()
      .then(setHistory)
      .catch(() => undefined);
  }, [loadHistory]);

  async function startSimulation() {
    setGenerating(true);
    try {
      const res = await genQuestions({
        data: {
          interviewType,
          targetRole: targetRole.trim() || undefined,
          sector: sector.trim() || undefined,
          difficulty,
          format,
          lang,
          count: 6,
        },
      });
      setSimulationId(res.id);
      setQuestions(res.questions);
      setIndex(0);
      setAnalysis(null);
      setExample(null);
      setScreen("run");
    } catch (e) {
      toast.error(friendlyError(e, fr));
    } finally {
      setGenerating(false);
    }
  }

  function speakQuestion(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = fr ? "fr-FR" : "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  useEffect(() => {
    if (screen === "run" && immersive && questions[index]) {
      speakQuestion(questions[index].text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, index, immersive]);

  async function handleTake(take: InterviewTake) {
    const question = questions[index];
    if (!question || !simulationId) return;
    setProcessing(true);
    try {
      const b64 = await blobToBase64(take.blob);
      const { text, words, duration } = await transcribe({
        data: { audioBase64: b64, mimeType: take.mimeType, lang },
      });
      if (!text.trim()) {
        toast.error(
          fr ? "Je n'ai rien entendu. Réessaie." : "I couldn't hear anything. Try again.",
        );
        return;
      }
      const dur = duration ?? take.durationSec;
      const hes = analyzeHesitations(words ?? [], dur, lang);
      const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
      const form: FormMetrics = {
        wpm: Math.round((wordCount / Math.max(1, dur)) * 60),
        hesitations: hes.total,
        hesitationsPerMin: hes.perMinute,
        fillers: hes.breakdown.filler,
        pauses: hes.breakdown.long_pause,
        postureScore: take.posture?.postureScore,
        gazeCameraPct: take.posture?.gazeCameraPct,
        stabilityScore: take.posture?.stabilityScore,
        expressivity: take.posture?.expressivity,
        handsUsagePct: take.posture?.handsUsagePct,
      };
      const res = await analyzeStar({
        data: {
          simulationId,
          questionIndex: index,
          questionText: question.text,
          transcript: text,
          durationSec: dur,
          lang,
          formMetrics: form,
        },
      });
      setAnalysis({
        responseId: res.id,
        transcript: text,
        star: res.star,
        form,
        mediaUrl: take.mediaUrl,
        withVideo: format === "video",
      });
      setExample(null);
      setScreen("result");
      if (res.unlocked?.length) {
        for (const b of res.unlocked) {
          toast.success(`${b.icon} ${fr ? b.title_fr : b.title_en}`);
        }
      }
      loadHistory()
        .then(setHistory)
        .catch(() => undefined);
    } catch (e) {
      toast.error(friendlyError(e, fr));
    } finally {
      setProcessing(false);
    }
  }

  async function showExample() {
    if (!analysis) return;
    setExampleLoading(true);
    try {
      const res = await genExample({
        data: {
          responseId: analysis.responseId,
          questionText: questions[index]?.text ?? "",
          transcript: analysis.transcript,
          targetRole: targetRole.trim() || undefined,
          lang,
        },
      });
      setExample(res.example);
    } catch (e) {
      toast.error(friendlyError(e, fr));
    } finally {
      setExampleLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AuthedNav />
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-24 sm:px-6">
        <header className="space-y-2">
          <p className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium">
            <Briefcase className="h-3.5 w-3.5 text-primary" />
            {fr ? "Simulation d'entretien" : "Mock interview"}
          </p>
          <h1 className="font-serif text-3xl leading-tight sm:text-4xl">
            {fr ? "Structure tes réponses en STAR." : "Structure your answers with STAR."}
          </h1>
          <p className="text-muted-foreground">
            {fr
              ? "Des questions sur mesure, ta réponse enregistrée, et un retour bienveillant sur le fond (Situation, Tâche, Action, Résultat) comme sur la forme."
              : "Tailored questions, your recorded answer, and warm feedback on both structure (Situation, Task, Action, Result) and delivery."}
          </p>
          <nav className="flex flex-wrap gap-2 pt-1">
            <TabBtn
              active={screen !== "history"}
              onClick={() => setScreen(simulationId ? "run" : "config")}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {fr ? "Simulation" : "Simulation"}
            </TabBtn>
            <TabBtn active={screen === "history"} onClick={() => setScreen("history")}>
              <HistoryIcon className="h-3.5 w-3.5" />
              {fr ? "Historique" : "History"}
            </TabBtn>
          </nav>
        </header>

        {screen === "config" && (
          <ConfigScreen
            fr={fr}
            interviewType={interviewType}
            setInterviewType={setInterviewType}
            targetRole={targetRole}
            setTargetRole={setTargetRole}
            sector={sector}
            setSector={setSector}
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            format={format}
            setFormat={setFormat}
            immersive={immersive}
            setImmersive={setImmersive}
            generating={generating}
            onStart={startSimulation}
          />
        )}

        {screen === "run" && questions[index] && (
          <section className="space-y-4">
            <div className="rounded-3xl border bg-gradient-to-br from-secondary/40 to-card p-6">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {fr ? "Question" : "Question"} {index + 1}/{questions.length} ·{" "}
                  {questions[index].kind}
                </span>
                <button
                  onClick={() => speakQuestion(questions[index].text)}
                  className="min-h-11 rounded-full px-2 underline-offset-2 hover:underline"
                >
                  {fr ? "Écouter la question" : "Play question"}
                </button>
              </div>
              <p className="font-serif text-2xl leading-snug">{questions[index].text}</p>
            </div>

            <StarGuide fr={fr} open={showGuide} onToggle={() => setShowGuide((s) => !s)} />

            <div className="rounded-3xl border bg-card p-6">
              <InterviewRecorder
                key={`${simulationId}-${index}`}
                withVideo={format === "video"}
                busy={processing}
                onDone={handleTake}
              />
              {processing && (
                <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {fr ? "Analyse de ta réponse…" : "Analyzing your answer…"}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
                disabled={index >= questions.length - 1 || processing}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm disabled:opacity-50"
              >
                {fr ? "Question suivante" : "Next question"}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setScreen("config")}
                className="inline-flex min-h-11 items-center rounded-full border px-4 text-sm text-muted-foreground"
              >
                {fr ? "Nouvelle simulation" : "New simulation"}
              </button>
            </div>
          </section>
        )}

        {screen === "result" && analysis && (
          <ResultScreen
            fr={fr}
            analysis={analysis}
            example={example}
            exampleLoading={exampleLoading}
            onExample={showExample}
            onRetry={() => {
              setAnalysis(null);
              setScreen("run");
            }}
            onNext={() => {
              setAnalysis(null);
              setIndex((i) => Math.min(questions.length - 1, i + 1));
              setScreen("run");
            }}
            hasNext={index < questions.length - 1}
          />
        )}

        {screen === "history" && (
          <HistoryScreen
            fr={fr}
            rows={history}
            onDelete={async (id) => {
              try {
                await removeResponse({ data: { id } });
                setHistory((h) => h.filter((r) => r.id !== id));
              } catch (e) {
                toast.error(friendlyError(e, fr));
              }
            }}
          />
        )}
      </main>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm ${
        active ? "bg-primary text-primary-foreground" : "border text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ConfigScreen(props: {
  fr: boolean;
  interviewType: InterviewType;
  setInterviewType: (v: InterviewType) => void;
  targetRole: string;
  setTargetRole: (v: string) => void;
  sector: string;
  setSector: (v: string) => void;
  difficulty: InterviewDifficulty;
  setDifficulty: (v: InterviewDifficulty) => void;
  format: InterviewFormat;
  setFormat: (v: InterviewFormat) => void;
  immersive: boolean;
  setImmersive: (v: boolean) => void;
  generating: boolean;
  onStart: () => void;
}) {
  const { fr } = props;
  const types: { id: InterviewType; label: string }[] = [
    { id: "rh", label: fr ? "Premier entretien RH" : "HR screening" },
    { id: "technique", label: fr ? "Entretien technique" : "Technical" },
    { id: "managerial", label: fr ? "Entretien managérial" : "Managerial" },
    { id: "libre", label: fr ? "Mode libre" : "Free mode" },
  ];
  const levels: { id: InterviewDifficulty; label: string }[] = [
    { id: "basique", label: fr ? "Questions basiques" : "Basic" },
    { id: "standard", label: fr ? "Standard" : "Standard" },
    { id: "avance", label: fr ? "Questions pièges" : "Tricky" },
  ];
  return (
    <section className="space-y-4">
      <div className="rounded-3xl border bg-card p-6">
        <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
          {fr ? "Type d'entretien" : "Interview type"}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {types.map((tt) => (
            <button
              key={tt.id}
              onClick={() => props.setInterviewType(tt.id)}
              className={`min-h-11 rounded-2xl border px-4 py-3 text-left text-sm ${
                props.interviewType === tt.id ? "border-primary bg-primary/10" : ""
              }`}
            >
              {tt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="rounded-3xl border bg-card p-4 text-sm">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {fr ? "Poste visé (optionnel)" : "Target role (optional)"}
          </span>
          <input
            value={props.targetRole}
            onChange={(e) => props.setTargetRole(e.target.value)}
            placeholder={fr ? "Chef de projet digital" : "Digital project manager"}
            className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3"
          />
        </label>
        <label className="rounded-3xl border bg-card p-4 text-sm">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {fr ? "Secteur (optionnel)" : "Sector (optional)"}
          </span>
          <input
            value={props.sector}
            onChange={(e) => props.setSector(e.target.value)}
            placeholder={fr ? "Santé, tech, retail…" : "Health, tech, retail…"}
            className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3"
          />
        </label>
      </div>

      <div className="rounded-3xl border bg-card p-6">
        <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
          {fr ? "Niveau de difficulté" : "Difficulty"}
        </p>
        <div className="flex flex-wrap gap-2">
          {levels.map((l) => (
            <button
              key={l.id}
              onClick={() => props.setDifficulty(l.id)}
              className={`min-h-11 rounded-full border px-4 text-sm ${
                props.difficulty === l.id ? "border-primary bg-primary/10" : ""
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <p className="mb-3 mt-6 text-xs uppercase tracking-wide text-muted-foreground">
          {fr ? "Format" : "Format"}
        </p>
        <div className="flex flex-wrap gap-2">
          {(["audio", "video"] as InterviewFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => props.setFormat(f)}
              className={`min-h-11 rounded-full border px-4 text-sm ${
                props.format === f ? "border-primary bg-primary/10" : ""
              }`}
            >
              {f === "audio"
                ? fr
                  ? "Audio seul"
                  : "Audio only"
                : fr
                  ? "Audio + vidéo (posture & regard)"
                  : "Audio + video (posture & gaze)"}
            </button>
          ))}
        </div>

        <label className="mt-5 flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={props.immersive}
            onChange={(e) => props.setImmersive(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          {fr
            ? "Mode immersif : la question est lue à voix haute"
            : "Immersive mode: the question is read aloud"}
        </label>
      </div>

      <button
        onClick={props.onStart}
        disabled={props.generating}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {props.generating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {props.generating
          ? fr
            ? "Préparation de tes questions…"
            : "Preparing your questions…"
          : fr
            ? "Lancer la simulation"
            : "Start the simulation"}
      </button>
    </section>
  );
}

function StarGuide({ fr, open, onToggle }: { fr: boolean; open: boolean; onToggle: () => void }) {
  const steps = fr
    ? [
        ["Situation", "Plante le contexte en 1-2 phrases."],
        ["Tâche", "Quel était ton rôle, ton objectif ?"],
        ["Action", "Ce que tu as concrètement fait."],
        ["Résultat", "L'issue, si possible chiffrée."],
      ]
    : [
        ["Situation", "Set the context in 1-2 sentences."],
        ["Task", "What was your role or goal?"],
        ["Action", "What you concretely did."],
        ["Result", "The outcome, ideally quantified."],
      ];
  return (
    <div className="rounded-3xl border bg-card/60 p-4">
      <button
        onClick={onToggle}
        className="flex min-h-11 w-full items-center justify-between text-left text-sm"
      >
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <Lightbulb className="h-4 w-4 text-accent" />
          {fr ? "Guide STAR" : "STAR guide"}
        </span>
        <span className="text-xs text-muted-foreground">
          {open ? (fr ? "Masquer" : "Hide") : fr ? "Afficher" : "Show"}
        </span>
      </button>
      {open && (
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {steps.map(([k, v]) => (
            <li key={k} className="rounded-2xl bg-background p-3 text-sm">
              <span className="font-medium">{k}</span>
              <span className="block text-muted-foreground">{v}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const STATUS_STYLE: Record<StarPart["status"], string> = {
  present: "bg-emerald-500/15 text-emerald-700",
  partial: "bg-amber-500/15 text-amber-700",
  absent: "bg-muted text-muted-foreground",
};

function ResultScreen({
  fr,
  analysis,
  example,
  exampleLoading,
  onExample,
  onRetry,
  onNext,
  hasNext,
}: {
  fr: boolean;
  analysis: Analysis;
  example: string | null;
  exampleLoading: boolean;
  onExample: () => void;
  onRetry: () => void;
  onNext: () => void;
  hasNext: boolean;
}) {
  const s = analysis.star;
  const labels = fr
    ? { situation: "Situation", tache: "Tâche", action: "Action", resultat: "Résultat" }
    : { situation: "Situation", tache: "Task", action: "Action", resultat: "Result" };
  const statusLabel = (st: StarPart["status"]) =>
    st === "present"
      ? fr
        ? "Présent"
        : "Present"
      : st === "partial"
        ? fr
          ? "Partiellement présent"
          : "Partially present"
        : fr
          ? "À ajouter"
          : "To add";

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border bg-gradient-to-br from-secondary/40 to-card p-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {fr ? "Structuration STAR" : "STAR structure"}
        </p>
        <p className="font-serif text-5xl">
          {s.structureScore}
          <span className="ml-1 text-base text-muted-foreground">/100</span>
        </p>
        {s.overallNote && <p className="mt-3 text-sm">{s.overallNote}</p>}
        {!s.quantified && (
          <p className="mt-3 rounded-2xl bg-background/60 p-3 text-sm">
            {fr
              ? "Piste : ajoute un chiffre ou un résultat concret à la fin — c'est ce qui rend une réponse mémorable."
              : "Tip: add a number or concrete outcome at the end — that's what makes an answer memorable."}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(["situation", "tache", "action", "resultat"] as const).map((k) => {
          const part = s[k];
          return (
            <article key={k} className="rounded-3xl border bg-card p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-serif text-xl">{labels[k]}</h2>
                <span className={`rounded-full px-2.5 py-1 text-xs ${STATUS_STYLE[part.status]}`}>
                  {part.status === "present" ? (
                    <CheckCircle2 className="mr-1 inline h-3 w-3" />
                  ) : (
                    <CircleDashed className="mr-1 inline h-3 w-3" />
                  )}
                  {statusLabel(part.status)}
                </span>
              </div>
              {part.excerpt && (
                <p className="mt-3 rounded-2xl bg-background p-3 text-sm italic">
                  “{part.excerpt}”
                </p>
              )}
              {part.suggestion && <p className="mt-3 text-sm">{part.suggestion}</p>}
            </article>
          );
        })}
      </div>

      {analysis.withVideo && <VideoMetricsPanel fr={fr} metrics={analysis.form} />}

      <div className="rounded-3xl border bg-card p-5">
        <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
          {fr ? "Et sur la forme" : "Delivery"}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Metric label={fr ? "Débit" : "Pace"} value={`${analysis.form.wpm ?? "—"}`} unit="wpm" />
          <Metric
            label={fr ? "Hésitations" : "Hesitations"}
            value={`${analysis.form.hesitations ?? 0}`}
            unit={`${analysis.form.hesitationsPerMin ?? 0}/min`}
          />
        </div>
        {analysis.mediaUrl &&
          (analysis.withVideo ? (
            <video src={analysis.mediaUrl} controls className="mt-4 w-full rounded-2xl" />
          ) : (
            <audio src={analysis.mediaUrl} controls className="mt-4 w-full" />
          ))}
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            {fr ? "Voir la transcription" : "View transcript"}
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-sm">{analysis.transcript}</p>
        </details>
      </div>

      <div className="rounded-3xl border bg-card p-5">
        {example ? (
          <>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              {fr ? "Exemple de réponse structurée" : "Model STAR answer"}
            </p>
            <p className="whitespace-pre-wrap text-sm">{example}</p>
          </>
        ) : (
          <button
            onClick={onExample}
            disabled={exampleLoading}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm disabled:opacity-60"
          >
            {exampleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lightbulb className="h-4 w-4" />
            )}
            {fr ? "Voir un exemple inspirant" : "Show an inspiring example"}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onRetry}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          <RefreshCw className="h-4 w-4" />
          {fr ? "Réessayer cette question" : "Retry this question"}
        </button>
        {hasNext && (
          <button
            onClick={onNext}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-sm"
          >
            {fr ? "Question suivante" : "Next question"}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-serif text-xl">
        {value}
        {unit && <span className="ml-1 text-xs text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}

type HistoryRow = Awaited<ReturnType<typeof listInterviewHistory>>[number];

function videoMetrics(r: HistoryRow): VideoMetricValues | null {
  const m = (r.form_metrics ?? {}) as Record<string, unknown>;
  const num = (k: string) => (typeof m[k] === "number" ? (m[k] as number) : undefined);
  const values: VideoMetricValues = {
    gazeCameraPct: num("gazeCameraPct"),
    postureScore: num("postureScore"),
    stabilityScore: num("stabilityScore"),
    expressivity: num("expressivity"),
    handsUsagePct: num("handsUsagePct"),
  };
  const hasAny = Object.values(values).some((v) => v !== undefined);
  return hasAny ? values : null;
}

function avgOf(list: (number | undefined)[]) {
  const vals = list.filter((v): v is number => typeof v === "number");
  if (!vals.length) return undefined;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function Sparkline({ label, values, unit }: { label: string; values: number[]; unit: string }) {
  const last = values[values.length - 1] ?? 0;
  return (
    <div className="rounded-2xl border bg-background p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-serif text-lg">
          {Math.round(last)}
          <span className="ml-0.5 text-xs text-muted-foreground">{unit}</span>
        </span>
      </div>
      <div className="mt-2 flex h-10 items-end gap-0.5">
        {values.slice(-16).map((v, i) => (
          <div
            key={i}
            title={`${Math.round(v)}${unit}`}
            className="flex-1 rounded-t bg-primary/50"
            style={{ height: `${Math.max(6, Math.min(100, v))}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function HistoryScreen({
  fr,
  rows,
  onDelete,
}: {
  fr: boolean;
  rows: Awaited<ReturnType<typeof listInterviewHistory>>;
  onDelete: (id: string) => void;
}) {
  const [videoOnly, setVideoOnly] = useState(false);

  if (!rows.length) {
    return (
      <div className="rounded-3xl border bg-card p-8 text-center text-muted-foreground">
        {fr
          ? "Aucune simulation pour l'instant. Lance ta première question d'entretien."
          : "No simulation yet. Start your first interview question."}
      </div>
    );
  }
  const withVideo = rows.filter((r) => videoMetrics(r) !== null);
  const visible = videoOnly ? withVideo : rows;
  const avg = Math.round(rows.reduce((a, r) => a + (r.structure_score ?? 0), 0) / rows.length);
  const ordered = [...rows].reverse();
  const videoOrdered = [...withVideo].reverse().map((r) => videoMetrics(r)!);
  const gazeSeries = videoOrdered
    .map((m) => m.gazeCameraPct)
    .filter((v): v is number => typeof v === "number");
  const postureSeries = videoOrdered
    .map((m) => m.postureScore)
    .filter((v): v is number => typeof v === "number");
  const stabilitySeries = videoOrdered
    .map((m) => m.stabilityScore)
    .filter((v): v is number => typeof v === "number");

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border bg-card p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {fr ? "Score STAR moyen" : "Average STAR score"}
        </p>
        <p className="font-serif text-4xl">
          {avg}
          <span className="ml-1 text-base text-muted-foreground">/100</span>
        </p>
        <div className="mt-4 flex h-24 items-end gap-1">
          {ordered.slice(-24).map((r) => (
            <div
              key={r.id}
              title={`${r.structure_score}/100`}
              className="flex-1 rounded-t bg-primary/60"
              style={{ height: `${Math.max(4, r.structure_score ?? 0)}%` }}
            />
          ))}
        </div>
      </div>

      {withVideo.length > 0 && (
        <>
          <VideoMetricsPanel
            fr={fr}
            metrics={{
              gazeCameraPct: avgOf(videoOrdered.map((m) => m.gazeCameraPct)),
              postureScore: avgOf(videoOrdered.map((m) => m.postureScore)),
              stabilityScore: avgOf(videoOrdered.map((m) => m.stabilityScore)),
              expressivity: avgOf(videoOrdered.map((m) => m.expressivity)),
              handsUsagePct: avgOf(videoOrdered.map((m) => m.handsUsagePct)),
            }}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            {gazeSeries.length > 0 && (
              <Sparkline
                label={fr ? "Regard caméra" : "Eye contact"}
                values={gazeSeries}
                unit="%"
              />
            )}
            {postureSeries.length > 0 && (
              <Sparkline label={fr ? "Posture" : "Posture"} values={postureSeries} unit="" />
            )}
            {stabilitySeries.length > 0 && (
              <Sparkline label={fr ? "Stabilité" : "Stability"} values={stabilitySeries} unit="" />
            )}
          </div>
          <button
            onClick={() => setVideoOnly((v) => !v)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm"
          >
            {videoOnly
              ? fr
                ? "Voir toutes les sessions"
                : "Show all sessions"
              : fr
                ? "Voir seulement les sessions vidéo"
                : "Show video sessions only"}
          </button>
        </>
      )}

      <ul className="space-y-3">
        {visible.map((r) => {
          const vm = videoMetrics(r);
          return (
            <li key={r.id} className="rounded-3xl border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString(fr ? "fr-FR" : "en-US")}
                  </p>
                  <p className="mt-1 font-serif text-lg">{r.question_text}</p>
                  {r.overall_note && (
                    <p className="mt-1 text-sm text-muted-foreground">{r.overall_note}</p>
                  )}
                  {vm && <VideoMetricChips fr={fr} metrics={vm} />}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">
                    {r.structure_score}/100
                  </span>
                  <button
                    onClick={() => onDelete(r.id)}
                    aria-label={fr ? "Supprimer" : "Delete"}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function friendlyError(e: unknown, fr: boolean) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("RATE_LIMIT"))
    return fr
      ? "Trop de demandes, réessaie dans un instant."
      : "Too many requests, try again shortly.";
  if (msg.includes("NO_CREDITS"))
    return fr ? "Crédits IA épuisés pour le moment." : "AI credits exhausted for now.";
  return msg;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}
