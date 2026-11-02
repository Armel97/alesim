import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { startRecorder, type RecorderHandle } from "@/lib/audio-recorder";
import { AudioConsentDeniedError } from "@/lib/audio-consent";
import {
  analyzePronunciation,
  transcribeInLanguage,
  type PronunciationResult,
  type TranscribedWord,
} from "@/lib/languages.functions";
import type { PracticeLang } from "@/lib/language-content";
import { useLang } from "@/lib/i18n";
import { toast } from "sonner";

type Props = {
  reference: string;
  targetLang: PracticeLang;
  onDone: (r: {
    transcript: string;
    result: PronunciationResult;
    durationSec: number;
    words: TranscribedWord[];
    apiDurationSec?: number;
  }) => void;
};

export function PronunciationRecorder({ reference, targetLang, onDone }: Props) {
  const { t, lang } = useLang();
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
  const [level, setLevelState] = useState(0);
  const recRef = useRef<RecorderHandle | null>(null);
  const startedAtRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  const transcribe = useServerFn(transcribeInLanguage);
  const analyze = useServerFn(analyzePronunciation);

  useEffect(() => () => recRef.current?.cancel(), []);

  const tick = () => {
    if (recRef.current) setLevelState(recRef.current.getLevel());
    rafRef.current = requestAnimationFrame(tick);
  };

  const start = async () => {
    try {
      const h = await startRecorder("practice");
      recRef.current = h;
      startedAtRef.current = Date.now();
      setState("recording");
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      if (err instanceof AudioConsentDeniedError) {
        toast.error(
          lang === "en"
            ? "Microphone declined: you can read the phrase out loud and listen to the model instead."
            : "Micro refusé : vous pouvez lire la phrase à voix haute et écouter le modèle sans analyse.",
        );
        return;
      }
      console.error(err);
      toast.error(t.micDenied);
    }
  };

  const stop = async () => {
    const h = recRef.current;
    if (!h) return;
    cancelAnimationFrame(rafRef.current);
    setState("processing");
    try {
      const blob = await h.stop();
      recRef.current = null;
      if (blob.size < 2048) {
        toast.error(t.error);
        setState("idle");
        return;
      }
      const b64 = await blobToBase64(blob);
      const { text, words, duration } = await transcribe({
        data: { audioBase64: b64, mimeType: blob.type, lang: targetLang },
      });
      if (!text.trim()) {
        toast.error(t.error);
        setState("idle");
        return;
      }
      const result = await analyze({
        data: { reference, transcript: text, lang: targetLang, uiLang: lang },
      });
      const durationSec = (Date.now() - startedAtRef.current) / 1000;
      onDone({
        transcript: text,
        result,
        durationSec,
        words,
        apiDurationSec: duration,
      });
      setState("idle");
    } catch (err) {
      console.error(err);
      toast.error(t.error);
      setState("idle");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {state === "recording" && (
          <div
            className="absolute inset-0 rounded-full bg-accent/20"
            style={{ transform: `scale(${1 + level * 0.6})`, transition: "transform 80ms linear" }}
          />
        )}
        <button
          type="button"
          onClick={state === "idle" ? start : state === "recording" ? stop : undefined}
          disabled={state === "processing"}
          aria-label={state === "recording" ? t.stopRecording : t.startRecording}
          className={`relative flex h-24 w-24 items-center justify-center rounded-full text-accent-foreground transition-all disabled:opacity-70 ${
            state === "recording"
              ? "bg-accent shadow-glow animate-pulse-ring"
              : "bg-gradient-ink shadow-soft hover:scale-105"
          }`}
        >
          {state === "processing" ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : state === "recording" ? (
            <Square className="h-8 w-8 fill-current" />
          ) : (
            <Mic className="h-9 w-9" />
          )}
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        {state === "recording" ? (
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="inline-block w-1 rounded-full bg-accent animate-wave"
                  style={{ height: `${8 + level * 16}px`, animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </span>
            {t.listening}
          </span>
        ) : state === "processing" ? (
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            {t.analyzing}
          </span>
        ) : (
          t.readAloud
        )}
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
