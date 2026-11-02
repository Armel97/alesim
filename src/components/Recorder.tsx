import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Sparkles, TimerReset } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { startRecorder, type RecorderHandle } from "@/lib/audio-recorder";
import {
  analyzeSpeech,
  transcribeAudio,
  type FeedbackResult,
  type TranscribedWord,
} from "@/lib/alesim.functions";
import { saveSession } from "@/lib/history-store";
import { useLang } from "@/lib/i18n";
import { uiLocale, localeLabel } from "@/lib/speech-locale";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import { MediaPermissionPanel } from "@/components/MediaPermissionPanel";
import { classifyMediaError, type MediaPermissionError } from "@/lib/media-permissions";
import { AudioConsentDeniedError, revokeAudioConsent } from "@/lib/audio-consent";
import { AudioConsentFallback } from "@/components/AudioConsentFallback";

type Result = {
  transcript: string;
  durationSec: number;
  feedback: FeedbackResult;
  words: TranscribedWord[];
  audioUrl?: string;
};

const AUTO_STOP_KEY = "alesim.autoStopSilence";
const SILENCE_LEVEL = 0.04; // below this RMS level counts as silence
const SILENCE_STOP_SEC = 20;
const SILENCE_WARN_SEC = 15; // start showing countdown 5s before auto-stop

export function Recorder({ prompt, onDone }: { prompt?: string; onDone?: (r: Result) => void }) {
  const { t, lang } = useLang();
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [silenceLeft, setSilenceLeft] = useState<number | null>(null);
  const [permError, setPermError] = useState<MediaPermissionError | null>(null);
  const [consentRefused, setConsentRefused] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [autoStopOn, setAutoStopOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(AUTO_STOP_KEY) !== "0";
  });
  const recRef = useRef<RecorderHandle | null>(null);
  const startedAtRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const silenceSinceRef = useRef<number | null>(null);
  const autoStopRef = useRef<boolean>(autoStopOn);
  const autoTriggeredRef = useRef<boolean>(false);

  useEffect(() => {
    autoStopRef.current = autoStopOn;
    if (typeof window !== "undefined") {
      localStorage.setItem(AUTO_STOP_KEY, autoStopOn ? "1" : "0");
    }
  }, [autoStopOn]);

  const transcribe = useServerFn(transcribeAudio);
  const analyze = useServerFn(analyzeSpeech);

  useEffect(() => () => recRef.current?.cancel(), []);

  const tick = () => {
    if (state !== "recording" && !recRef.current) return;
    if (recRef.current) {
      const lvl = recRef.current.getLevel();
      setLevel(lvl);
      const now = Date.now();
      // Only start counting silence once the user has had ~1s to begin talking.
      const sinceStart = (now - startedAtRef.current) / 1000;
      if (autoStopRef.current && sinceStart > 1) {
        if (lvl < SILENCE_LEVEL) {
          if (silenceSinceRef.current === null) silenceSinceRef.current = now;
          const silentFor = (now - silenceSinceRef.current) / 1000;
          if (silentFor >= SILENCE_STOP_SEC && !autoTriggeredRef.current) {
            autoTriggeredRef.current = true;
            toast(t.autoStoppedToast);
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
    }
    setElapsed((Date.now() - startedAtRef.current) / 1000);
    rafRef.current = requestAnimationFrame(tick);
  };

  const start = async () => {
    try {
      setRetrying(true);
      const h = await startRecorder("recorder");
      recRef.current = h;
      setPermError(null);
      setConsentRefused(false);
      startedAtRef.current = Date.now();
      silenceSinceRef.current = null;
      autoTriggeredRef.current = false;
      setSilenceLeft(null);
      setElapsed(0);
      setState("recording");
      rafRef.current = requestAnimationFrame(tick);
      track("record_start", { hasPrompt: !!prompt, lang });
    } catch (err) {
      if (err instanceof AudioConsentDeniedError) {
        setConsentRefused(true);
        setPermError(null);
        return;
      }
      console.error(err);
      const info = classifyMediaError(err, "mic");
      setPermError(info);
      if (info.issue === "denied") toast.error(t.micDenied);
    } finally {
      setRetrying(false);
    }
  };

  const stop = async () => {
    const h = recRef.current;
    if (!h) return;
    cancelAnimationFrame(rafRef.current);
    setSilenceLeft(null);
    setState("processing");
    try {
      const blob = await h.stop();
      recRef.current = null;
      const durationSec = Math.max(0.5, (Date.now() - startedAtRef.current) / 1000);

      if (blob.size < 2048) {
        toast.error(t.error);
        setState("idle");
        return;
      }

      const b64 = await blobToBase64(blob);
      const {
        text,
        words,
        duration: apiDur,
      } = await transcribe({ data: { audioBase64: b64, mimeType: blob.type, lang } });
      if (!text.trim()) {
        toast.error(t.error);
        setState("idle");
        return;
      }
      const trueDuration = apiDur ?? durationSec;
      const feedback = await analyze({
        data: { transcript: text, durationSec: trueDuration, lang, prompt },
      });
      const audioUrl = URL.createObjectURL(blob);
      const result: Result = {
        transcript: text,
        durationSec: trueDuration,
        feedback,
        words,
        audioUrl,
      };

      saveSession({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        durationSec: trueDuration,
        transcript: text,
        prompt,
        feedback,
        lang,
      });
      onDone?.(result);
      track("record_complete", { durationSec: Math.round(trueDuration), lang });
      setState("idle");
    } catch (err) {
      console.error(err);
      toast.error(t.error);
      setState("idle");
    }
  };

  const mmss = (s: number) => {
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const sec = Math.floor(s % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${sec}`;
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {consentRefused && (
        <AudioConsentFallback
          prompt={prompt}
          onRetryMic={() => {
            // Le refus est réversible : on efface la décision et on redemande.
            revokeAudioConsent("recorder-retry");
            setConsentRefused(false);
            void start();
          }}
          onDone={(r) =>
            onDone?.({
              transcript: r.transcript,
              durationSec: r.durationSec,
              feedback: r.feedback,
              words: [],
            })
          }
        />
      )}
      {permError && (
        <MediaPermissionPanel error={permError} retrying={retrying} onRetry={() => void start()} />
      )}
      <div className="relative flex h-48 w-48 items-center justify-center">
        {/* Anneaux ambiants — respiration au repos, écho vivant pendant l'écoute. */}
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-0 rounded-full border border-primary/15 ${
            state === "idle" ? "animate-breath" : ""
          }`}
        />
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-4 rounded-full border border-primary/10 ${
            state === "idle" ? "animate-breath" : ""
          }`}
          style={state === "idle" ? { animationDelay: "0.8s" } : undefined}
        />
        {state === "recording" && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-primary/15"
            style={{ transform: `scale(${1 + level * 0.5})`, transition: "transform 90ms linear" }}
          />
        )}
        <button
          type="button"
          onClick={state === "idle" ? start : state === "recording" ? stop : undefined}
          disabled={state === "processing"}
          aria-label={state === "recording" ? t.stopRecording : t.startRecording}
          className={`relative flex h-32 w-32 items-center justify-center rounded-full text-primary-foreground transition-all duration-500 disabled:opacity-70 ${
            state === "recording"
              ? "bg-gradient-sage shadow-glow animate-pulse-ring"
              : "bg-gradient-sage shadow-soft hover:shadow-glow"
          }`}
        >
          {state === "processing" ? (
            <Loader2 className="h-10 w-10 animate-spin" />
          ) : state === "recording" ? (
            <Square className="h-10 w-10 fill-current" />
          ) : (
            <Mic className="h-12 w-12" />
          )}
        </button>
      </div>

      <div className="text-center">
        <div className="font-serif text-3xl text-foreground tabular-nums">
          {state === "recording" || state === "processing" ? mmss(elapsed) : "00:00"}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {state === "recording" ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex items-end gap-[3px] h-5">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <span
                    key={i}
                    className="inline-block w-[3px] rounded-full bg-primary animate-wave origin-center"
                    style={{
                      height: `${10 + level * 18}px`,
                      animationDelay: `${i * 0.11}s`,
                    }}
                  />
                ))}
              </span>
              <span className="text-primary/80">{t.listening}</span>
            </span>
          ) : state === "processing" ? (
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              {t.analyzing}
            </span>
          ) : (
            t.startRecording
          )}
        </p>
        {state === "recording" && silenceLeft !== null && (
          <p
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs text-foreground/80"
            aria-live="polite"
          >
            <TimerReset className="h-3.5 w-3.5 text-accent" />
            {t.autoStopCountdown.replace("{n}", String(silenceLeft))}
          </p>
        )}
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-foreground/70 select-none">
        <input
          type="checkbox"
          checked={autoStopOn}
          onChange={(e) => setAutoStopOn(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <span>
          {t.autoStopSilence}
          <span className="ml-1 text-muted-foreground">· {t.autoStopSilenceHint}</span>
        </span>
      </label>

      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">{t.sttLangLabel}</span>{" "}
        <span className="rounded-full bg-secondary px-2 py-0.5 font-semibold tracking-wider text-secondary-foreground">
          {localeLabel(uiLocale(lang))}
        </span>
        <span className="ml-1">{t.sttLangHint.replace("{loc}", uiLocale(lang))}</span>
      </p>
    </div>
  );
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
