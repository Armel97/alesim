import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { saveOnboardingProfile } from "@/lib/onboarding.functions";
import { transcribeAudio } from "@/lib/alesim.functions";
import { startRecorder, type RecorderHandle } from "@/lib/audio-recorder";
import { AudioConsentDeniedError } from "@/lib/audio-consent";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mic, Square, ChevronRight, ChevronLeft, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "ALESIM — Bienvenue" },
      { name: "description", content: "Configurez votre parcours ALESIM en 60 secondes." },
      { property: "og:title", content: "ALESIM — Bienvenue" },
      { property: "og:description", content: "Configurez votre parcours ALESIM en 60 secondes." },
    ],
  }),
  component: OnboardingPage,
});

type Step = 0 | 1 | 2 | 3 | 4 | 5;

function OnboardingPage() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(0);
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [availability, setAvailability] = useState<"5" | "10" | "20">("10");
  const [recording, setRecording] = useState(false);
  const [rec, setRec] = useState<RecorderHandle | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [baselineWpm, setBaselineWpm] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  const slides = [
    { title: t.slideWelcome1Title, body: t.slideWelcome1Body },
    { title: t.slideWelcome2Title, body: t.slideWelcome2Body },
    { title: t.slideWelcome3Title, body: t.slideWelcome3Body },
    { title: t.slideWelcome4Title, body: t.slideWelcome4Body },
  ];

  async function startMic() {
    try {
      const r = await startRecorder("onboarding-test");
      setRec(r);
      setStartedAt(Date.now());
      setRecording(true);
    } catch (err) {
      if (err instanceof AudioConsentDeniedError) {
        toast.error(
          lang === "en"
            ? "Microphone declined: you can skip the voice test and set your level manually."
            : "Micro refusé : vous pouvez passer le test vocal et choisir votre niveau manuellement.",
        );
        return;
      }
      toast.error(t.micDenied);
    }
  }

  async function stopMic() {
    if (!rec) return;
    setRecording(false);
    setAnalyzing(true);
    try {
      const blob = await rec.stop();
      const durationSec = Math.max(0.1, (Date.now() - startedAt) / 1000);
      const b64 = await blobToBase64(blob);
      const { text } = await transcribeAudio({
        data: { audioBase64: b64, mimeType: "audio/wav", lang },
      });
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      const wpm = durationSec > 0 ? Math.round((words / durationSec) * 60) : 0;
      setBaselineWpm(wpm);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAnalyzing(false);
      setRec(null);
    }
  }

  async function finish() {
    setSaving(true);
    try {
      await saveOnboardingProfile({
        data: {
          goal,
          level,
          availability,
          baselineWpm: baselineWpm ?? undefined,
        },
      });
      navigate({ to: "/today" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const canNext = step < 4 || (step === 4 && !!goal && !!level && !!availability);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-6">
        <span className="font-serif text-2xl">ALESIM</span>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <LogOut className="h-3.5 w-3.5" /> {t.signOut}
        </button>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-16">
        <div className="mb-8 flex gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-secondary"}`}
            />
          ))}
        </div>

        {step < 4 && (
          <div className="rounded-2xl border bg-card p-10 text-center">
            <h1 className="font-serif text-4xl">{slides[step].title}</h1>
            <p className="mt-4 text-muted-foreground">{slides[step].body}</p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-8">
            <section>
              <h2 className="font-serif text-xl mb-3">{t.yourGoal}</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["interview", t.goalInterview],
                  ["public", t.goalPublic],
                  ["stutter", t.goalStutter],
                  ["language", t.goalLanguage],
                ].map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setGoal(v)}
                    className={`rounded-xl border p-4 text-sm text-left transition-colors ${
                      goal === v ? "border-primary bg-primary/5" : "hover:bg-secondary"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <h2 className="font-serif text-xl mb-3">{t.yourLevel}</h2>
              <div className="flex gap-2">
                {(["beginner", "intermediate", "advanced"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setLevel(v)}
                    className={`flex-1 rounded-full border px-4 py-2 text-sm ${
                      level === v ? "border-primary bg-primary text-primary-foreground" : ""
                    }`}
                  >
                    {v === "beginner"
                      ? t.levelBeginner
                      : v === "intermediate"
                        ? t.levelIntermediate
                        : t.levelAdvanced}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <h2 className="font-serif text-xl mb-3">{t.availability}</h2>
              <div className="flex gap-2">
                {(["5", "10", "20"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setAvailability(v)}
                    className={`flex-1 rounded-full border px-4 py-2 text-sm ${
                      availability === v ? "border-primary bg-primary text-primary-foreground" : ""
                    }`}
                  >
                    {v === "5" ? t.avail5 : v === "10" ? t.avail10 : t.avail20}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {step === 5 && (
          <div className="rounded-2xl border bg-card p-8 text-center space-y-6">
            <div>
              <h2 className="font-serif text-2xl">{t.microTest}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t.microTestPrompt}</p>
            </div>
            {baselineWpm === null ? (
              <button
                onClick={recording ? stopMic : startMic}
                disabled={analyzing}
                className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
              >
                {analyzing ? (
                  <span className="text-xs">{t.analyzing}</span>
                ) : recording ? (
                  <Square className="h-8 w-8" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </button>
            ) : (
              <div className="rounded-xl bg-secondary p-6">
                <p className="text-xs uppercase text-muted-foreground">{t.baselineWpm}</p>
                <p className="mt-1 font-serif text-4xl">{baselineWpm}</p>
                <p className="text-xs text-muted-foreground">{t.wpm}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1) as Step)}
            disabled={step === 0}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" /> {t.back}
          </button>
          {step < 5 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={!canNext}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-6 py-2.5 text-sm text-primary-foreground disabled:opacity-50"
            >
              {t.next} <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={saving}
              className="rounded-full bg-primary px-6 py-2.5 text-sm text-primary-foreground disabled:opacity-50"
            >
              {t.getStarted}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
