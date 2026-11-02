import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Keyboard, Mic, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { analyzeSpeech, type FeedbackResult } from "@/lib/alesim.functions";
import { saveSession } from "@/lib/history-store";

const COPY = {
  fr: {
    title: "Sans micro, on continue autrement",
    lead: "Vous avez refusé l'accès au micro : aucun son n'est capté ni analysé. Vous pouvez malgré tout obtenir un retour en écrivant ce que vous vouliez dire.",
    placeholder: "Écrivez ici le texte de votre prise de parole…",
    duration: "Temps de parole estimé (secondes)",
    analyze: "Analyser mon texte",
    retry: "Changer d'avis et autoriser le micro",
    tooShort: "Écrivez au moins quelques phrases pour obtenir un retour utile.",
    error: "Une erreur est survenue. Réessayez.",
  },
  en: {
    title: "No mic? We keep going",
    lead: "You declined microphone access: nothing is captured or analysed. You can still get feedback by typing what you wanted to say.",
    placeholder: "Type the speech you had in mind…",
    duration: "Estimated speaking time (seconds)",
    analyze: "Analyse my text",
    retry: "Change my mind and allow the mic",
    tooShort: "Write at least a couple of sentences to get useful feedback.",
    error: "Something went wrong. Please try again.",
  },
} as const;

export function AudioConsentFallback({
  prompt,
  onRetryMic,
  onDone,
}: {
  prompt?: string;
  onRetryMic: () => void;
  onDone?: (r: { transcript: string; durationSec: number; feedback: FeedbackResult }) => void;
}) {
  const { lang } = useLang();
  const c = COPY[lang === "en" ? "en" : "fr"];
  const [text, setText] = useState("");
  const [seconds, setSeconds] = useState(60);
  const [busy, setBusy] = useState(false);
  const analyze = useServerFn(analyzeSpeech);

  const run = async () => {
    const transcript = text.trim();
    if (transcript.split(/\s+/).length < 12) {
      toast.error(c.tooShort);
      return;
    }
    setBusy(true);
    try {
      const durationSec = Math.max(5, Math.min(1800, seconds));
      const feedback = await analyze({ data: { transcript, durationSec, lang, prompt } });
      saveSession({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        durationSec,
        transcript,
        prompt,
        feedback,
        lang,
      });
      onDone?.({ transcript, durationSec, feedback });
    } catch (err) {
      console.error(err);
      toast.error(c.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-xl rounded-2xl border border-border bg-card/80 p-5 text-left shadow-soft">
      <h3 className="flex items-center gap-2 font-serif text-lg text-foreground">
        <Keyboard className="h-5 w-5 text-primary" />
        {c.title}
      </h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{c.lead}</p>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={c.placeholder}
        rows={6}
        className="mt-4"
      />

      <label className="mt-3 flex items-center gap-3 text-xs text-foreground/80">
        <span>{c.duration}</span>
        <input
          type="number"
          min={5}
          max={1800}
          value={seconds}
          onChange={(e) => setSeconds(Number(e.target.value))}
          className="h-9 w-24 rounded-md border border-border bg-background px-2 text-sm"
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => void run()} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {c.analyze}
        </Button>
        <Button variant="ghost" onClick={onRetryMic}>
          <Mic className="mr-2 h-4 w-4" />
          {c.retry}
        </Button>
      </div>
    </div>
  );
}
