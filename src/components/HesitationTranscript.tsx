import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, MessageCircle, Repeat, Timer, Sparkles } from "lucide-react";
import type { TranscribedWord } from "@/lib/alesim.functions";
import { analyzeHesitations, indexHesitations, type Hesitation } from "@/lib/hesitation-analysis";
import { useLang } from "@/lib/i18n";

type Props = {
  words: TranscribedWord[];
  durationSec: number;
  audioUrl?: string;
  previousRate?: number; // last hesitation rate for comparison message
};

export function HesitationTranscript({ words, durationSec, audioUrl, previousRate }: Props) {
  const { t, lang } = useLang();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentIdx, setCurrentIdx] = useState<number>(-1);

  const analysis = useMemo(
    () => analyzeHesitations(words, durationSec, lang),
    [words, durationSec, lang],
  );
  const byWord = useMemo(() => indexHesitations(analysis.hesitations), [analysis]);

  // Sync the "current word" highlight during playback.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const tick = () => {
      const time = a.currentTime;
      let idx = -1;
      for (let i = 0; i < words.length; i++) {
        if (time >= words[i].start && time <= words[i].end + 0.05) {
          idx = i;
          break;
        }
        if (time < words[i].start) break;
      }
      setCurrentIdx(idx);
    };
    a.addEventListener("timeupdate", tick);
    a.addEventListener("play", () => setPlaying(true));
    a.addEventListener("pause", () => setPlaying(false));
    a.addEventListener("ended", () => {
      setPlaying(false);
      setCurrentIdx(-1);
    });
    return () => a.removeEventListener("timeupdate", tick);
  }, [words]);

  const jumpTo = (sec: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, sec - 0.05);
    void a.play();
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  };

  if (!words.length) return null;

  const supportiveMessage = buildSupportiveMessage(analysis.perMinute, previousRate, lang);

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
      {/* Synthetic counter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {t.hesitationTranscriptTitle}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Chip
            tone="warning"
            icon={<MessageCircle className="h-3 w-3" />}
            label={t.fillerEvent}
            value={analysis.breakdown.filler}
          />
          <Chip
            tone="muted"
            icon={<Timer className="h-3 w-3" />}
            label={t.pauseEvent}
            value={analysis.breakdown.long_pause}
          />
          <Chip
            tone="accent"
            icon={<Repeat className="h-3 w-3" />}
            label={t.repetitionEvent}
            value={analysis.breakdown.repetition}
          />
          <span className="rounded-full bg-secondary px-2.5 py-1 text-foreground/70">
            {analysis.total} {t.hesitationsTotal} · {analysis.perMinute}/{t.minutesShort}
          </span>
        </div>
      </div>

      {/* Audio player */}
      {audioUrl && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border/60 bg-secondary/40 px-3 py-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? t.pauseEvent : t.playAudio}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft transition-transform hover:scale-105"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <p className="text-xs text-muted-foreground">{t.tapToReplay}</p>
          <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
        </div>
      )}

      {/* Highlighted transcript */}
      <p className="mt-5 font-serif text-xl leading-relaxed text-foreground">
        {words.map((w, i) => {
          const h = byWord.get(i);
          const isCurrent = i === currentIdx;
          const prevGapHesitation =
            !h && i > 0
              ? analysis.hesitations.find((x) => x.type === "long_pause" && x.wordIndex === i)
              : null;
          return (
            <span key={i}>
              {prevGapHesitation && (
                <PauseMarker hesitation={prevGapHesitation} onJump={jumpTo} label={t.pauseAt} />
              )}
              <HesitationWord
                word={w}
                hesitation={h && h.type !== "long_pause" ? h : undefined}
                isCurrent={isCurrent}
                onJump={jumpTo}
              />{" "}
            </span>
          );
        })}
      </p>

      {/* Supportive message */}
      <p className="mt-5 rounded-2xl bg-primary/8 px-4 py-3 text-sm leading-relaxed text-foreground/85">
        {supportiveMessage}
      </p>
    </div>
  );
}

function HesitationWord({
  word,
  hesitation,
  isCurrent,
  onJump,
}: {
  word: TranscribedWord;
  hesitation?: Hesitation;
  isCurrent: boolean;
  onJump: (s: number) => void;
}) {
  const base = "cursor-pointer rounded px-0.5 transition-colors";
  const currentRing = isCurrent ? "ring-2 ring-primary/70" : "";
  if (!hesitation) {
    return (
      <span
        onClick={() => onJump(word.start)}
        className={`${base} ${currentRing} hover:bg-secondary`}
      >
        {word.word.trim()}
      </span>
    );
  }
  const tone =
    hesitation.type === "filler"
      ? "bg-yellow-200/70 text-foreground hover:bg-yellow-300/80"
      : "bg-orange-200/70 text-foreground hover:bg-orange-300/80";
  return (
    <span
      title={hesitation.context}
      onClick={() => onJump(hesitation.start)}
      className={`${base} ${tone} ${currentRing} font-medium`}
    >
      {word.word.trim()}
    </span>
  );
}

function PauseMarker({
  hesitation,
  onJump,
  label,
}: {
  hesitation: Hesitation;
  onJump: (s: number) => void;
  label: string;
}) {
  const dur = hesitation.extra?.pauseSec?.toFixed(1) ?? "";
  return (
    <span
      onClick={() => onJump(hesitation.start)}
      title={`${label} ${dur}s`}
      className="mx-1 inline-flex cursor-pointer items-center gap-1 rounded-full bg-muted-foreground/15 px-2 py-0.5 align-middle text-xs text-muted-foreground hover:bg-muted-foreground/25"
    >
      ···<span className="font-mono">{dur}s</span>
    </span>
  );
}

function Chip({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "warning" | "muted" | "accent";
}) {
  const cls = {
    warning: "bg-yellow-200/60 text-foreground",
    muted: "bg-muted-foreground/15 text-foreground",
    accent: "bg-orange-200/60 text-foreground",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${cls}`}>
      {icon}
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

function buildSupportiveMessage(
  rate: number,
  previous: number | undefined,
  lang: "fr" | "en",
): string {
  if (typeof previous === "number" && Number.isFinite(previous)) {
    if (rate < previous - 0.3) {
      return lang === "fr"
        ? `Tu as hésité un peu moins souvent qu'à ton dernier enregistrement (${rate}/min contre ${previous}/min) — continue ainsi !`
        : `You hesitated a bit less than last time (${rate}/min vs ${previous}/min) — keep it up!`;
    }
    if (rate > previous + 0.3) {
      return lang === "fr"
        ? `Un peu plus d'hésitations qu'à ton dernier essai (${rate}/min). Respire, ralentis, tu as le temps.`
        : `A few more hesitations than last time (${rate}/min). Breathe, slow down — you have time.`;
    }
    return lang === "fr"
      ? `Rythme d'hésitations stable (${rate}/min). Prochaine étape : viser un peu moins.`
      : `Steady hesitation rate (${rate}/min). Next step: aim a bit lower.`;
  }
  if (rate <= 2) {
    return lang === "fr"
      ? `Très peu d'hésitations (${rate}/min) — ton discours est fluide.`
      : `Very few hesitations (${rate}/min) — your delivery flows nicely.`;
  }
  if (rate <= 6) {
    return lang === "fr"
      ? `Rythme d'hésitations correct (${rate}/min). Repère les moments surlignés et ré-écoute-les.`
      : `Reasonable hesitation rate (${rate}/min). Tap the highlights to re-listen to those moments.`;
  }
  return lang === "fr"
    ? `Beaucoup d'hésitations aujourd'hui (${rate}/min) — c'est normal, prends une grande respiration avant de reprendre.`
    : `Lots of hesitations today (${rate}/min) — that's okay, take a deep breath before the next take.`;
}
