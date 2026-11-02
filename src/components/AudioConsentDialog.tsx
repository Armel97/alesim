import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Mic, ShieldCheck, Trash2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { registerAudioConsentPrompt, setAudioConsent } from "@/lib/audio-consent";

const COPY = {
  fr: {
    title: "Autoriser l'analyse de votre voix",
    lead: "Avant d'activer le micro, nous avons besoin de votre accord explicite. Vous restez libre de refuser : ALESIM reste utilisable sans micro.",
    purposes: "Ce à quoi vous consentez",
    p1: "Capter le son de votre micro pendant l'exercice, uniquement quand vous appuyez sur enregistrer.",
    p2: "Transcrire votre prise de parole (reconnaissance vocale) pour mesurer débit, clarté et hésitations.",
    p3: "Générer un retour pédagogique par IA à partir de cette transcription.",
    p4: "Conserver l'historique de vos séances sur cet appareil (vous pouvez le supprimer à tout moment).",
    retention: "Ce que nous ne faisons pas",
    r1: "Aucun enregistrement n'est conservé sur nos serveurs : l'audio est transmis le temps de l'analyse puis supprimé.",
    r2: "Aucune revente, aucun profilage publicitaire, aucun partage à des tiers hors sous-traitants d'analyse.",
    withdraw:
      "Vous pouvez retirer votre consentement à tout moment depuis votre profil, aussi facilement que vous le donnez.",
    policy: "Politique de confidentialité",
    accept: "J'autorise le micro",
    refuse: "Refuser",
  },
  en: {
    title: "Allow voice analysis",
    lead: "Before turning on your microphone we need your explicit consent. You can decline: ALESIM stays usable without a mic.",
    purposes: "What you are consenting to",
    p1: "Capturing your microphone audio during an exercise, only while you press record.",
    p2: "Transcribing your speech to measure pace, clarity and hesitations.",
    p3: "Generating AI coaching feedback from that transcript.",
    p4: "Keeping your session history on this device (you can delete it anytime).",
    retention: "What we never do",
    r1: "No recording is stored on our servers: audio is sent only for the analysis, then discarded.",
    r2: "No resale, no ad profiling, no sharing beyond our analysis processors.",
    withdraw:
      "You can withdraw your consent at any time from your profile, as easily as you gave it.",
    policy: "Privacy policy",
    accept: "Allow microphone",
    refuse: "Decline",
  },
} as const;

/** Boîte de dialogue globale de consentement audio (montée une fois dans __root). */
export function AudioConsentDialog() {
  const { lang } = useLang();
  const c = COPY[lang === "en" ? "en" : "fr"];
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState("unknown");
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const settle = useCallback((ok: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setOpen(false);
    resolve?.(ok);
  }, []);

  useEffect(() => {
    registerAudioConsentPrompt((ctx) => {
      setContext(ctx);
      setOpen(true);
      return new Promise<boolean>((resolve) => {
        resolverRef.current?.(false);
        resolverRef.current = resolve;
      });
    });
    return () => {
      registerAudioConsentPrompt(null);
      resolverRef.current?.(false);
      resolverRef.current = null;
    };
  }, []);

  const decide = (ok: boolean) => {
    setAudioConsent(ok ? "granted" : "refused", context);
    settle(ok);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : settle(false))}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
            <Mic className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="font-serif text-xl">{c.title}</DialogTitle>
          <DialogDescription>{c.lead}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground/70">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              {c.purposes}
            </h3>
            <ul className="space-y-1.5 text-muted-foreground">
              {[c.p1, c.p2, c.p3, c.p4].map((line) => (
                <li key={line} className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60"
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl bg-secondary/60 p-3">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground/70">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              {c.retention}
            </h3>
            <ul className="space-y-1.5 text-muted-foreground">
              {[c.r1, c.r2].map((line) => (
                <li key={line} className="flex gap-2">
                  <Trash2 aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>

          <p className="text-xs text-muted-foreground">
            {c.withdraw}{" "}
            <Link to="/legal/confidentialite" className="underline underline-offset-2">
              {c.policy}
            </Link>
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => decide(false)}>
            {c.refuse}
          </Button>
          <Button onClick={() => decide(true)}>{c.accept}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
