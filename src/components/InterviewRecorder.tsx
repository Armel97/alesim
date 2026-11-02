import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, TimerReset, Video as VideoIcon } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { MediaPermissionPanel } from "@/components/MediaPermissionPanel";
import { classifyMediaError, type MediaPermissionError } from "@/lib/media-permissions";
import { logAudioConsent, requestAudioConsent, revokeAudioConsent } from "@/lib/audio-consent";
import {
  analyzeFrame,
  disposeVideoModels,
  loadVideoModels,
  summarizeSamples,
  type VideoAnalysisSummary,
  type VideoSample,
} from "@/lib/video-analysis";

const SILENCE_LEVEL = 0.04;
const SILENCE_STOP_SEC = 20;
const SILENCE_WARN_SEC = 15;

export type InterviewTake = {
  blob: Blob;
  mimeType: string;
  durationSec: number;
  mediaUrl: string;
  posture?: VideoAnalysisSummary;
};

/**
 * Recorder used inside the interview simulation: audio only, or audio + camera
 * with on-device posture/gaze sampling. Auto-stops after a long silence, like
 * the main audio module.
 */
export function InterviewRecorder({
  withVideo,
  busy,
  onDone,
}: {
  withVideo: boolean;
  busy?: boolean;
  onDone: (take: InterviewTake) => void;
}) {
  const { lang } = useLang();
  const fr = lang === "fr";
  const [phase, setPhase] = useState<"idle" | "preparing" | "ready" | "recording">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [silenceLeft, setSilenceLeft] = useState<number | null>(null);
  const [live, setLive] = useState<{ posture: number; gaze: number } | null>(null);
  const [permError, setPermError] = useState<MediaPermissionError | null>(null);
  const [consentRefused, setConsentRefused] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const samplesRef = useRef<VideoSample[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const rafRef = useRef<number>(0);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startAtRef = useRef<number>(0);
  const silenceSinceRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => () => cleanup(), []);

  function cleanup() {
    cancelAnimationFrame(rafRef.current);
    if (frameTimerRef.current) clearInterval(frameTimerRef.current);
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    if (withVideo) disposeVideoModels();
  }

  async function prepare() {
    try {
      setPhase("preparing");
      setPermError(null);
      const consented = await requestAudioConsent(withVideo ? "interview-video" : "interview");
      if (!consented) {
        setConsentRefused(true);
        setPhase("idle");
        return;
      }
      setConsentRefused(false);
      logAudioConsent("capture_started", withVideo ? "interview-video" : "interview");
      const modelsP = withVideo ? loadVideoModels() : Promise.resolve();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: withVideo ? { facingMode: "user", width: 1280, height: 720 } : false,
      });
      streamRef.current = stream;
      if (withVideo && videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      bufRef.current = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
      await modelsP;
      setPhase("ready");
    } catch (err) {
      console.error(err);
      const info = classifyMediaError(err, withVideo ? "both" : "mic");
      setPermError(info);
      if (info.issue === "denied") {
        toast.error(
          fr
            ? "Accès micro/caméra refusé. Autorise-le dans les réglages du navigateur."
            : "Mic/camera access denied. Allow it in your browser settings.",
        );
      }
      setPhase("idle");
    }
  }

  function rms() {
    const a = analyserRef.current;
    const buf = bufRef.current;
    if (!a || !buf) return 0;
    a.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length) * 4;
  }

  function start() {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    samplesRef.current = [];
    stoppedRef.current = false;
    const mimeType = withVideo
      ? MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : "video/webm"
      : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
    const rec = new MediaRecorder(stream, { mimeType });
    recRef.current = rec;
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.start(1000);
    startAtRef.current = performance.now();
    silenceSinceRef.current = null;
    setSilenceLeft(null);
    setElapsed(0);
    setPhase("recording");

    const tick = () => {
      const now = performance.now();
      const lvl = rms();
      setLevel(lvl);
      setElapsed((now - startAtRef.current) / 1000);
      if ((now - startAtRef.current) / 1000 > 1.5) {
        if (lvl < SILENCE_LEVEL) {
          if (silenceSinceRef.current === null) silenceSinceRef.current = now;
          const silentFor = (now - silenceSinceRef.current) / 1000;
          if (silentFor >= SILENCE_STOP_SEC && !stoppedRef.current) {
            toast(fr ? "Arrêt automatique après un silence." : "Auto-stopped after a silence.");
            void stop();
            return;
          }
          const remaining = Math.max(0, SILENCE_STOP_SEC - silentFor);
          setSilenceLeft(
            remaining <= SILENCE_STOP_SEC - SILENCE_WARN_SEC ? Math.ceil(remaining) : null,
          );
        } else {
          silenceSinceRef.current = null;
          setSilenceLeft(null);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    if (withVideo) {
      frameTimerRef.current = setInterval(() => {
        const v = videoRef.current;
        if (!v || v.readyState < 2) return;
        const t0 = (performance.now() - startAtRef.current) / 1000;
        const s = analyzeFrame(v, t0, performance.now());
        if (!s) return;
        samplesRef.current.push(s);
        const recent = samplesRef.current.slice(-15);
        setLive({
          posture: Math.round(
            (recent.reduce((a, x) => a + x.posturePosScore, 0) / recent.length) * 100,
          ),
          gaze: Math.round((recent.filter((x) => x.gazeCentered).length / recent.length) * 100),
        });
      }, 200);
    }
  }

  async function stop() {
    const rec = recRef.current;
    if (!rec || stoppedRef.current) return;
    stoppedRef.current = true;
    cancelAnimationFrame(rafRef.current);
    if (frameTimerRef.current) clearInterval(frameTimerRef.current);
    setSilenceLeft(null);
    const durationSec = Math.max(0.5, (performance.now() - startAtRef.current) / 1000);
    const blob: Blob = await new Promise((resolve) => {
      rec.onstop = () => resolve(new Blob(chunksRef.current, { type: rec.mimeType }));
      rec.stop();
    });
    recRef.current = null;
    setPhase("ready");
    onDone({
      blob,
      mimeType: withVideo ? "audio/webm" : blob.type || "audio/webm",
      durationSec,
      mediaUrl: URL.createObjectURL(blob),
      posture: withVideo ? summarizeSamples(samplesRef.current) : undefined,
    });
  }

  const mmss = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${Math.floor(s % 60)
      .toString()
      .padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center gap-4">
      {consentRefused && (
        <div className="w-full rounded-2xl border border-border bg-card/80 p-4 text-sm">
          <p className="font-medium text-foreground">
            {fr ? "Micro non autorisé" : "Microphone not allowed"}
          </p>
          <p className="mt-1 text-muted-foreground">
            {fr
              ? "Aucun son n'est capté. Vous pouvez préparer vos réponses STAR à l'écrit dans les fiches ci-dessous, ou autoriser le micro pour être analysé à l'oral."
              : "Nothing is being captured. You can prepare your STAR answers in writing below, or allow the microphone to be analysed out loud."}
          </p>
          <button
            type="button"
            className="mt-3 min-h-11 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
            onClick={() => {
              revokeAudioConsent("interview-retry");
              setConsentRefused(false);
              void prepare();
            }}
          >
            {fr ? "Autoriser le micro" : "Allow microphone"}
          </button>
        </div>
      )}
      {permError && (
        <MediaPermissionPanel
          error={permError}
          retrying={phase === "preparing"}
          onRetry={() => void prepare()}
        />
      )}
      {withVideo && (
        <div className="relative w-full overflow-hidden rounded-3xl border bg-secondary/40">
          <video
            ref={videoRef}
            muted
            playsInline
            className="aspect-video w-full scale-x-[-1] object-cover"
          />
          {live && phase === "recording" && (
            <div className="absolute bottom-2 left-2 flex gap-2 text-[11px]">
              <span className="rounded-full bg-background/80 px-2 py-1">
                {fr ? "Posture" : "Posture"} {live.posture}%
              </span>
              <span className="rounded-full bg-background/80 px-2 py-1">
                {fr ? "Regard" : "Gaze"} {live.gaze}%
              </span>
            </div>
          )}
        </div>
      )}

      {phase === "idle" || phase === "preparing" ? (
        <button
          type="button"
          onClick={prepare}
          disabled={phase === "preparing"}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {phase === "preparing" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : withVideo ? (
            <VideoIcon className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
          {phase === "preparing"
            ? fr
              ? "Préparation…"
              : "Preparing…"
            : withVideo
              ? fr
                ? "Activer micro + caméra"
                : "Enable mic + camera"
              : fr
                ? "Activer le micro"
                : "Enable microphone"}
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={phase === "recording" ? () => void stop() : start}
            disabled={busy}
            aria-label={
              phase === "recording"
                ? fr
                  ? "Terminer la réponse"
                  : "Finish answer"
                : fr
                  ? "Enregistrer ma réponse"
                  : "Record my answer"
            }
            className={`relative flex h-20 w-20 items-center justify-center rounded-full text-primary-foreground shadow-soft transition-all disabled:opacity-60 ${
              phase === "recording" ? "bg-gradient-sage animate-pulse-ring" : "bg-gradient-sage"
            }`}
          >
            {busy ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : phase === "recording" ? (
              <Square className="h-7 w-7 fill-current" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </button>
          <div className="text-center">
            <p className="font-serif text-2xl tabular-nums">
              {phase === "recording" ? mmss(elapsed) : "00:00"}
            </p>
            {phase === "recording" && (
              <span className="mt-1 inline-flex items-end gap-[3px]" aria-hidden>
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <span
                    key={i}
                    className="inline-block w-[3px] rounded-full bg-primary animate-wave"
                    style={{ height: `${8 + level * 18}px`, animationDelay: `${i * 0.11}s` }}
                  />
                ))}
              </span>
            )}
            {silenceLeft !== null && (
              <p
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs"
                aria-live="polite"
              >
                <TimerReset className="h-3.5 w-3.5 text-accent" />
                {fr ? `Arrêt automatique dans ${silenceLeft}s` : `Auto-stop in ${silenceLeft}s`}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
