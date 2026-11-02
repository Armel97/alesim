import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Camera,
  Circle,
  Loader2,
  RefreshCw,
  Square,
  Trash2,
  Sparkles,
  Eye,
  User,
  Mic,
} from "lucide-react";
import { AuthedNav } from "@/components/AuthedNav";
import { useLang } from "@/lib/i18n";
import { MediaPermissionPanel } from "@/components/MediaPermissionPanel";
import { classifyMediaError, type MediaPermissionError } from "@/lib/media-permissions";
import { logAudioConsent, requestAudioConsent, revokeAudioConsent } from "@/lib/audio-consent";
import { toast } from "sonner";
import {
  analyzeFrame,
  disposeVideoModels,
  loadVideoModels,
  summarizeSamples,
  type VideoAnalysisSummary,
  type VideoMarker,
  type VideoSample,
} from "@/lib/video-analysis";
import { transcribeAudio } from "@/lib/alesim.functions";
import { analyzeHesitations, type HesitationType } from "@/lib/hesitation-analysis";
import {
  deleteVideoSession,
  listVideoSessions,
  synthesizeVideoFeedback,
  type VideoSynthesis,
} from "@/lib/video.functions";

export const Route = createFileRoute("/_authenticated/video")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Vidéo — ALESIM" },
      {
        name: "description",
        content:
          "Entraîne-toi face caméra : posture, regard et éloquence analysés localement sur ton appareil.",
      },
      { property: "og:title", content: "ALESIM — Entraînement vidéo" },
      {
        property: "og:description",
        content:
          "Feedback bienveillant combiné voix + langage corporel après chaque prise de parole face caméra.",
      },
    ],
  }),
  component: VideoPage,
});

type Phase = "idle" | "loading-models" | "ready" | "recording" | "analyzing" | "done";

type FinalResult = {
  summary: VideoAnalysisSummary;
  hesitations: {
    total: number;
    perMinute: number;
    fillers: number;
    pauses: number;
    repetitions: number;
  };
  hesitationEvents: { t: number; kind: HesitationType }[];
  transcript: string;
  synthesis: VideoSynthesis;
  videoUrl: string;
  durationSec: number;
  prompt?: string;
};

function VideoPage() {
  const { t, lang } = useLang();
  const [phase, setPhase] = useState<Phase>("idle");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [permError, setPermError] = useState<MediaPermissionError | null>(null);
  const [consentRefused, setConsentRefused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [prompt, setPrompt] = useState<string>("");
  const [result, setResult] = useState<FinalResult | null>(null);
  const [live, setLive] = useState<{ posture: number; gaze: number; hands: number }>({
    posture: 0,
    gaze: 0,
    hands: 0,
  });
  const [history, setHistory] = useState<Awaited<ReturnType<typeof listVideoSessions>>>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const samplesRef = useRef<VideoSample[]>([]);
  const startAtRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const analysisTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const transcribe = useServerFn(transcribeAudio);
  const synthesize = useServerFn(synthesizeVideoFeedback);
  const listSessions = useServerFn(listVideoSessions);
  const deleteSession = useServerFn(deleteVideoSession);

  const prompts = useMemo(
    () =>
      lang === "fr"
        ? [
            "Présente-toi en 1 minute.",
            "Explique pourquoi ce poste t'intéresse.",
            "Pitch ton projet en 60 secondes.",
            "Raconte une réussite dont tu es fier·e.",
          ]
        : [
            "Introduce yourself in 1 minute.",
            "Explain why this role interests you.",
            "Pitch your project in 60 seconds.",
            "Share a recent win you're proud of.",
          ],
    [lang],
  );

  useEffect(() => {
    listSessions()
      .then(setHistory)
      .catch(() => undefined);
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (analysisTimerRef.current) clearInterval(analysisTimerRef.current);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      disposeVideoModels();
    };
  }, [listSessions]);

  const openCamera = async (nextFacing: "user" | "environment" = facing) => {
    try {
      setPhase("loading-models");
      setPermError(null);
      const consented = await requestAudioConsent("video");
      if (!consented) {
        setConsentRefused(true);
        setPhase("idle");
        return;
      }
      setConsentRefused(false);
      logAudioConsent("capture_started", "video");
      // Kick off model load in parallel with camera acquisition.
      const modelsP = loadVideoModels();
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing, width: 1280, height: 720 },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      await modelsP;
      setPhase("ready");
    } catch (err) {
      console.error(err);
      const info = classifyMediaError(err, "both");
      setPermError(info);
      if (info.issue === "denied") toast.error(t.videoCameraDenied);
      setPhase("idle");
    }
  };

  const swapCamera = async () => {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    await openCamera(next);
  };

  const start = () => {
    const stream = streamRef.current;
    const video = videoRef.current;
    if (!stream || !video) return;
    chunksRef.current = [];
    samplesRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : "video/webm";
    const rec = new MediaRecorder(stream, { mimeType });
    recorderRef.current = rec;
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.start(1000);
    startAtRef.current = performance.now();
    setElapsed(0);
    setPhase("recording");

    const tick = () => {
      setElapsed((performance.now() - startAtRef.current) / 1000);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    // Sample pose/face every 200ms (5 fps)
    analysisTimerRef.current = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.readyState < 2) return;
      const t0 = (performance.now() - startAtRef.current) / 1000;
      const s = analyzeFrame(v, t0, performance.now());
      if (s) {
        samplesRef.current.push(s);
        // Rolling live indicators from the last ~15 samples (~3s)
        const recent = samplesRef.current.slice(-15);
        const posture = Math.round(
          (recent.reduce((a, x) => a + x.posturePosScore, 0) / recent.length) * 100,
        );
        const gaze = Math.round(
          (recent.filter((x) => x.gazeCentered).length / recent.length) * 100,
        );
        const hands = Math.round(
          (recent.filter((x) => x.handsVisible).length / recent.length) * 100,
        );
        setLive({ posture, gaze, hands });
      }
    }, 200);
  };

  const stop = async () => {
    const rec = recorderRef.current;
    if (!rec) return;
    cancelAnimationFrame(rafRef.current);
    if (analysisTimerRef.current) clearInterval(analysisTimerRef.current);
    setPhase("analyzing");

    const blob: Blob = await new Promise((resolve) => {
      rec.onstop = () => resolve(new Blob(chunksRef.current, { type: rec.mimeType }));
      rec.stop();
    });
    const durationSec = Math.max(0.5, (performance.now() - startAtRef.current) / 1000);

    try {
      // Local aggregation of pose/face metrics
      const posSummary = summarizeSamples(samplesRef.current);

      // Audio transcription (video/webm blob works with Whisper; force audio mime)
      const b64 = await blobToBase64(blob);
      const { text, words, duration } = await transcribe({
        data: { audioBase64: b64, mimeType: "audio/webm", lang },
      });
      const trueDur = duration ?? durationSec;

      const hesitationAnalysis = analyzeHesitations(words ?? [], trueDur, lang);
      const hesitations = {
        total: hesitationAnalysis.total,
        perMinute: hesitationAnalysis.perMinute,
        fillers: hesitationAnalysis.breakdown.filler,
        pauses: hesitationAnalysis.breakdown.long_pause,
        repetitions: hesitationAnalysis.breakdown.repetition,
      };

      const combinedMarkers: VideoMarker[] = [
        ...posSummary.markers,
        ...hesitationAnalysis.hesitations.slice(0, 30).map((h) => ({
          t: h.start,
          kind:
            h.type === "filler"
              ? ("filler" as const)
              : h.type === "long_pause"
                ? ("pause" as const)
                : ("repetition" as const),
        })),
      ];

      const synthesis = await synthesize({
        data: {
          lang,
          prompt: prompt || undefined,
          durationSec: trueDur,
          transcript: text ?? "",
          posture: {
            gazeCameraPct: posSummary.gazeCameraPct,
            postureScore: posSummary.postureScore,
            stabilityScore: posSummary.stabilityScore,
            expressivity: posSummary.expressivity,
            handsUsagePct: posSummary.handsUsagePct,
            headTiltAvgDeg: posSummary.headTiltAvgDeg,
            shoulderTiltAvgDeg: posSummary.shoulderTiltAvgDeg,
            samples: posSummary.samples,
          },
          hesitations,
          markers: combinedMarkers,
        },
      });

      const videoUrl = URL.createObjectURL(blob);
      setResult({
        summary: { ...posSummary, markers: combinedMarkers },
        hesitations,
        hesitationEvents: hesitationAnalysis.hesitations.map((h) => ({
          t: h.start,
          kind: h.type,
        })),
        transcript: text ?? "",
        synthesis,
        videoUrl,
        durationSec: trueDur,
        prompt: prompt || undefined,
      });
      setPhase("done");
      // Refresh history in background
      listSessions()
        .then(setHistory)
        .catch(() => undefined);
    } catch (err) {
      console.error(err);
      toast.error(t.error);
      setPhase("ready");
    }
  };

  const reset = () => {
    if (result?.videoUrl) URL.revokeObjectURL(result.videoUrl);
    setResult(null);
    setPhase(streamRef.current ? "ready" : "idle");
  };

  const removeSession = async (id: string) => {
    try {
      await deleteSession({ data: { id } });
      setHistory((h) => h.filter((s) => s.id !== id));
      toast.success(t.videoDeleted);
    } catch {
      toast.error(t.error);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <AuthedNav />
      <main className="mx-auto w-full max-w-4xl px-6 pb-24">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-[0.18em] text-primary">{t.videoTab}</p>
          <h1 className="mt-2 font-serif text-3xl text-foreground">{t.videoTitle}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t.videoLead}</p>
          <p className="mt-3 rounded-2xl bg-primary/8 px-4 py-3 text-xs text-foreground/80">
            {t.videoPrivacy}
          </p>
        </header>

        {!result && (
          <>
            <section className="mb-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                {t.videoChoosePrompt}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPrompt("")}
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    prompt === ""
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  {t.videoFreeMode}
                </button>
                {prompts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPrompt(p)}
                    className={`rounded-full px-3 py-1.5 text-sm ${
                      prompt === p
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </section>

            <div className="relative aspect-video overflow-hidden rounded-3xl border border-border/60 bg-black shadow-soft">
              <video
                ref={videoRef}
                muted
                playsInline
                className="h-full w-full object-cover"
                style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
              />
              {/* Silhouette guide */}
              {phase !== "recording" && (
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full opacity-60"
                  viewBox="0 0 100 56"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <ellipse
                    cx="50"
                    cy="18"
                    rx="8"
                    ry="10"
                    fill="none"
                    stroke="white"
                    strokeDasharray="1.5 1.5"
                    strokeWidth="0.4"
                  />
                  <path
                    d="M 32 46 C 34 34, 66 34, 68 46"
                    fill="none"
                    stroke="white"
                    strokeDasharray="1.5 1.5"
                    strokeWidth="0.4"
                  />
                </svg>
              )}
              {phase === "recording" && (
                <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-xs text-white backdrop-blur">
                  <Circle className="h-3 w-3 fill-red-500 text-red-500 animate-pulse" />
                  {mmss(elapsed)}
                </div>
              )}
              {phase === "recording" && (
                <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-3 rounded-full bg-black/60 px-3 py-2 text-xs text-white backdrop-blur">
                  <LiveBadge
                    icon={<User className="h-3 w-3" />}
                    label={t.videoPosture}
                    value={live.posture}
                  />
                  <LiveBadge
                    icon={<Eye className="h-3 w-3" />}
                    label={t.videoGaze}
                    value={live.gaze}
                  />
                  <LiveBadge
                    icon={<Sparkles className="h-3 w-3" />}
                    label={t.videoHands}
                    value={live.hands}
                  />
                </div>
              )}
              {phase === "idle" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 text-white">
                  <Camera className="h-10 w-10" />
                  <button
                    onClick={() => openCamera()}
                    className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground"
                  >
                    {t.videoEnableCamera}
                  </button>
                </div>
              )}
              {phase === "loading-models" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">{t.videoLoadingModels}</p>
                </div>
              )}
              {phase === "analyzing" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">{t.videoAnalyzing}</p>
                </div>
              )}
            </div>

            {permError && (
              <div className="mt-4">
                <MediaPermissionPanel
                  error={permError}
                  retrying={phase === "loading-models"}
                  onRetry={() => void openCamera()}
                />
              </div>
            )}

            {consentRefused && (
              <div className="mt-4 rounded-2xl border border-border bg-card/80 p-4 text-sm">
                <p className="font-medium text-foreground">
                  {lang === "en" ? "Capture not allowed" : "Capture non autorisée"}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {lang === "en"
                    ? "Nothing is captured. The other modules (written feedback, coach plan, history) stay available."
                    : "Rien n'est capté. Les autres modules (retour écrit, plan du coach, historique) restent accessibles."}
                </p>
                <button
                  type="button"
                  className="mt-3 min-h-11 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
                  onClick={() => {
                    revokeAudioConsent("video-retry");
                    setConsentRefused(false);
                    void openCamera();
                  }}
                >
                  {lang === "en" ? "Allow mic & camera" : "Autoriser micro et caméra"}
                </button>
              </div>
            )}

            {(phase === "ready" || phase === "recording") && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={swapCamera}
                  disabled={phase === "recording"}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs text-foreground hover:bg-secondary disabled:opacity-40"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t.videoSwapCamera}
                </button>
                {phase === "ready" ? (
                  <button
                    type="button"
                    onClick={start}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm text-primary-foreground shadow-soft"
                  >
                    <Circle className="h-4 w-4 fill-current" />
                    {t.videoStart}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stop}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm text-primary-foreground shadow-soft"
                  >
                    <Square className="h-4 w-4 fill-current" />
                    {t.videoStop}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {result && <ResultView result={result} onReset={reset} />}

        {history.length > 0 && !result && (
          <section className="mt-10">
            <h2 className="mb-3 font-serif text-xl text-foreground">{t.videoHistory}</h2>
            <ul className="space-y-2">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">{h.prompt ?? t.videoFreeMode}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString(lang === "fr" ? "fr-FR" : "en-US")} ·{" "}
                      {h.duration_sec}s · {t.videoGaze} {h.gaze_camera_pct}%
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSession(h.id)}
                    aria-label={t.delete}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

function LiveBadge({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1">
      {icon}
      <span className="opacity-80">{label}</span>
      <span className="font-semibold tabular-nums">{value}%</span>
    </span>
  );
}

function ResultView({ result, onReset }: { result: FinalResult; onReset: () => void }) {
  const { t } = useLang();
  const vidRef = useRef<HTMLVideoElement | null>(null);
  const dur = result.durationSec;
  const jump = (t0: number) => {
    const v = vidRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, t0 - 0.1);
    void v.play();
  };

  const allMarkers = [...result.summary.markers.map((m) => ({ ...m }))];

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-black shadow-soft">
        <video
          ref={vidRef}
          src={result.videoUrl}
          controls
          playsInline
          className="aspect-video w-full"
        />
        {/* Annotated timeline */}
        <div className="relative h-8 bg-card">
          {allMarkers.map((m, i) => {
            const left = Math.max(0, Math.min(100, (m.t / dur) * 100));
            const color =
              m.kind === "gaze_away"
                ? "bg-blue-400"
                : m.kind === "slouch"
                  ? "bg-orange-400"
                  : m.kind === "filler"
                    ? "bg-yellow-400"
                    : m.kind === "pause"
                      ? "bg-muted-foreground"
                      : m.kind === "repetition"
                        ? "bg-red-400"
                        : "bg-green-400";
            return (
              <button
                key={i}
                type="button"
                onClick={() => jump(m.t)}
                title={`${m.kind} @ ${m.t.toFixed(1)}s`}
                className={`absolute top-1 h-6 w-1.5 rounded-sm ${color}`}
                style={{ left: `${left}%` }}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 border-t border-border/60 bg-card px-4 py-2 text-[11px] text-muted-foreground">
          <Legend color="bg-blue-400" label={t.videoLegendGaze} />
          <Legend color="bg-orange-400" label={t.videoLegendSlouch} />
          <Legend color="bg-yellow-400" label={t.videoLegendFiller} />
          <Legend color="bg-red-400" label={t.videoLegendRep} />
          <Legend color="bg-muted-foreground" label={t.videoLegendPause} />
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
        <p className="text-xs uppercase tracking-[0.18em] text-primary">{t.videoSummary}</p>
        <p className="mt-2 font-serif text-lg leading-relaxed text-foreground">
          {result.synthesis.summary}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <CategoryCard
          icon={<Mic className="h-4 w-4" />}
          title={t.videoVoice}
          score={Math.max(0, 100 - Math.min(100, result.hesitations.perMinute * 12))}
          note={result.synthesis.voice_note}
          detail={`${result.hesitations.total} · ${result.hesitations.perMinute}/min`}
        />
        <CategoryCard
          icon={<User className="h-4 w-4" />}
          title={t.videoPosture}
          score={result.summary.postureScore}
          note={result.synthesis.posture_note}
          detail={`${t.videoStability} ${result.summary.stabilityScore}/100`}
        />
        <CategoryCard
          icon={<Eye className="h-4 w-4" />}
          title={t.videoGaze}
          score={result.summary.gazeCameraPct}
          note={result.synthesis.gaze_note}
          detail={`${result.summary.gazeCameraPct}% ${t.videoAtCamera}`}
        />
      </div>

      {result.synthesis.suggestions.length > 0 && (
        <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
          <p className="text-xs uppercase tracking-[0.18em] text-primary">{t.videoSuggestions}</p>
          <ul className="mt-3 space-y-3">
            {result.synthesis.suggestions.map((s, i) => (
              <li key={i} className="rounded-2xl bg-secondary/60 p-3">
                <p className="font-medium text-foreground">
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">
                    {i + 1}
                  </span>
                  {s.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{s.how}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onReset}
          className="rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground"
        >
          {t.videoNewTake}
        </button>
      </div>
    </div>
  );
}

function CategoryCard({
  icon,
  title,
  score,
  note,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  score: number;
  note: string;
  detail?: string;
}) {
  const dot = score >= 70 ? "bg-emerald-500" : score >= 45 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {icon}
          {title}
        </span>
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
      </div>
      <p className="mt-3 font-serif text-3xl text-foreground tabular-nums">{score}</p>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      <p className="mt-3 text-sm leading-relaxed text-foreground/85">{note}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${color}`} />
      {label}
    </span>
  );
}

function mmss(sec: number) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
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
