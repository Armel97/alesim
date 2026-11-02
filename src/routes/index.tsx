import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Recorder } from "@/components/Recorder";
import { FeedbackCard } from "@/components/FeedbackCard";
import { useLang } from "@/lib/i18n";
import type { FeedbackResult, TranscribedWord } from "@/lib/alesim.functions";
import heroWaves from "@/assets/hero-waves.jpg";
import { RefreshCw, ShieldCheck, ArrowRight, Check } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SoftGate } from "@/components/SoftGate";
import { useAuthSession } from "@/hooks/useAuthSession";
import { track } from "@/lib/analytics";
import {
  clearGuestSession,
  hasContinuedWithoutAccount,
  incrementGuestRecordings,
  loadGuestPrompt,
  loadGuestResult,
  saveGuestPrompt,
  saveGuestResult,
} from "@/lib/guest-session";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "ALESIM — Coach vocal IA pour parler avec confiance" },
      {
        name: "description",
        content:
          "Entraînez votre voix avec ALESIM : enregistrez-vous, obtenez un feedback sur le débit, la clarté et les hésitations, et gagnez en confiance à l'oral.",
      },
      { property: "og:url", content: "https://alesimspeak.dev/" },
      { property: "og:title", content: "ALESIM — Coach vocal IA pour parler avec confiance" },
      {
        property: "og:description",
        content:
          "Enregistrez, transcrivez, recevez un retour immédiat sur votre débit, votre clarté et votre confiance à l'oral.",
      },
      { name: "twitter:title", content: "ALESIM — Coach vocal IA pour parler avec confiance" },
      {
        name: "twitter:description",
        content:
          "Enregistrez, transcrivez, recevez un retour immédiat sur votre débit, votre clarté et votre confiance à l'oral.",
      },
      { property: "og:image", content: "https://alesimspeak.dev/og-alesim.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "ALESIM — confiance et clarté à l'oral" },
      { name: "twitter:image", content: "https://alesimspeak.dev/og-alesim.jpg" },
    ],
    links: [
      { rel: "canonical", href: "https://alesimspeak.dev/" },
      { rel: "alternate", hrefLang: "fr", href: "https://alesimspeak.dev/" },
      { rel: "alternate", hrefLang: "en", href: "https://alesimspeak.dev/?hl=en" },
      { rel: "alternate", hrefLang: "x-default", href: "https://alesimspeak.dev/" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "ALESIM",
              url: "https://alesimspeak.dev/",
              description:
                "Coach vocal IA qui aide à progresser en clarté, débit et confiance à l'oral au quotidien.",
            },
            {
              "@type": "WebSite",
              name: "ALESIM",
              url: "https://alesimspeak.dev/",
            },
            {
              "@type": "SoftwareApplication",
              name: "ALESIM",
              url: "https://alesimspeak.dev/",
              applicationCategory: "EducationalApplication",
              applicationSubCategory: "Coaching vocal",
              operatingSystem: "Web, iOS, Android",
              inLanguage: ["fr", "en"],
              description:
                "Application de coaching vocal par IA : feedback sur le débit, la clarté et les hésitations, exercices de confiance et entraînement à la prononciation en langue étrangère.",
              offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
            },
          ],
        }),
      },
    ],
  }),
});

type Result = {
  transcript: string;
  durationSec: number;
  feedback: FeedbackResult;
  words?: TranscribedWord[];
  audioUrl?: string;
};

function Index() {
  const { t, lang } = useLang();
  const [prompt, setPrompt] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<Result | null>(null);
  const [showGate, setShowGate] = useState(false);
  const { signedIn, loading: authLoading } = useAuthSession();

  useEffect(() => {
    track("landing_view");
  }, []);

  // Restauration du contexte invité (sujet + dernier résultat), y compris au retour d'inscription.
  useEffect(() => {
    const savedPrompt = loadGuestPrompt();
    if (savedPrompt) setPrompt(savedPrompt);
    const saved = loadGuestResult();
    if (saved) {
      setResult({
        transcript: saved.transcript,
        durationSec: saved.durationSec,
        feedback: saved.feedback,
        ...(saved.words ? { words: saved.words } : {}),
      });
    }
  }, []);

  // Une fois le compte créé, le contexte est rattaché à l'utilisateur : on vide le stockage temporaire.
  useEffect(() => {
    if (signedIn) {
      clearGuestSession();
      setShowGate(false);
    }
  }, [signedIn]);

  const selectPrompt = (p?: string) => {
    setPrompt(p);
    saveGuestPrompt(p);
    track("topic_select", { topic: p ?? "free_mode" });
  };

  const handleDone = (r: Result) => {
    setResult(r);
    track("result_view", { signedIn });
    if (signedIn) return;
    const count = incrementGuestRecordings();
    saveGuestResult({
      transcript: r.transcript,
      durationSec: r.durationSec,
      feedback: r.feedback,
      ...(r.words ? { words: r.words } : {}),
      ...(prompt ? { prompt } : {}),
      createdAt: Date.now(),
    });
    // Le tout premier résultat n'est jamais bloqué : l'encart reste non bloquant,
    // et n'insiste qu'à partir du 2e enregistrement (ou si l'invité n'a pas déjà refusé).
    const gate = count >= 2 || !hasContinuedWithoutAccount();
    setShowGate(gate);
    if (gate) track("softgate_view", { recordings: count });
  };

  const reset = () => {
    setResult(null);
    setShowGate(false);
  };

  return (
    <div className="min-h-dvh bg-background">
      <main>
        <AppHeader />

        <section id="recorder" className="mx-auto w-full max-w-6xl px-6 pb-24">
          {!result ? (
            <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-accent">{t.tagline}</p>
                <h1 className="mt-4 font-serif text-6xl leading-[0.95] text-foreground md:text-7xl">
                  <span className="sr-only">Coach vocal IA pour parler avec confiance — </span>
                  {t.heroTitle}
                </h1>
                <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
                  {t.heroLead}
                </p>

                <div className="mt-10">
                  <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
                    {t.tryPrompt}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => selectPrompt(undefined)}
                      className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                        !prompt
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-card text-foreground hover:border-foreground/40"
                      }`}
                    >
                      {t.freeMode}
                    </button>
                    {t.prompts.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => selectPrompt(p)}
                        className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                          prompt === p
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-card text-foreground hover:border-foreground/40"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-10 rounded-2xl border border-border bg-card/70 p-4">
                  <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                    <span>{t.aboutLine}</span>
                  </p>
                  <Link
                    to="/legal/confidentialite"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-foreground underline underline-offset-4 hover:text-accent"
                  >
                    {t.privacyCta}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-warm p-10 shadow-soft">
                <img
                  src={heroWaves}
                  alt=""
                  aria-hidden
                  width={1600}
                  height={900}
                  decoding="async"
                  fetchPriority="high"
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
                />
                <div className="relative flex flex-col items-center gap-8 py-6">
                  {prompt && (
                    <div className="rounded-2xl bg-background/70 px-5 py-3 text-center font-serif text-lg text-foreground backdrop-blur">
                      &ldquo;{prompt}&rdquo;
                    </div>
                  )}
                  <Recorder prompt={prompt} onDone={handleDone} />
                  <p className="max-w-xs text-center text-xs text-foreground/70" key={lang}>
                    {lang === "fr"
                      ? "Appuyez, parlez naturellement. ALESIM écoute et vous répond."
                      : "Tap, speak naturally. ALESIM listens and responds."}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 pt-4">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-4xl text-foreground">{t.feedback}</h2>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
                >
                  <RefreshCw className="h-4 w-4" />
                  {t.newSession}
                </button>
              </div>
              <FeedbackCard {...result} />
              {!authLoading && !signedIn && showGate && (
                <SoftGate onDismiss={() => setShowGate(false)} />
              )}
            </div>
          )}
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-20" aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="font-serif text-4xl text-foreground">
            {t.howTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">{t.howLead}</p>
          <ol className="mt-8 grid gap-5 md:grid-cols-3">
            {t.howSteps.map((step, i) => (
              <li
                key={step.title}
                className="rounded-3xl border border-border bg-card p-6 shadow-soft"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary font-serif text-lg text-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-serif text-2xl text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-20" aria-labelledby="use-cases">
          <h2 id="use-cases" className="font-serif text-4xl text-foreground">
            {t.useCasesTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">{t.useCasesLead}</p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {t.useCases.map((c) => (
              <article key={c.title} className="rounded-3xl bg-gradient-warm p-6 shadow-soft">
                <h3 className="font-serif text-2xl text-foreground">{c.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-foreground/80">{c.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="pricing" className="mx-auto w-full max-w-6xl px-6 pb-24" aria-labelledby="pricing-title">
          <div className="mb-8 max-w-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-accent">ALESIM</p>
            <h2 id="pricing-title" className="mt-3 font-serif text-4xl text-foreground md:text-5xl">
              {t.pricingTitle}
            </h2>
            <p className="mt-4 text-muted-foreground">{t.pricingLead}</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <article className="flex flex-col rounded-3xl border border-border bg-card p-7 shadow-soft md:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-serif text-3xl text-foreground">{t.pricingFree}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{t.pricingFreeLimit}</p>
                </div>
                <p className="text-right">
                  <span className="block font-serif text-3xl text-foreground">{t.pricingFreePrice}</span>
                  <span className="text-xs text-muted-foreground">{t.pricingFreePeriod}</span>
                </p>
              </div>
              <ul className="mt-8 space-y-4 text-sm text-muted-foreground">
                {t.pricingFreeFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#recorder"
                className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                {t.pricingCtaFree}
              </a>
            </article>

            <article className="relative flex flex-col overflow-hidden rounded-3xl border-2 border-primary bg-gradient-sage p-7 text-primary-foreground shadow-glow md:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-primary-foreground/70">{t.pricingPremium}</p>
                  <h3 className="mt-2 font-serif text-3xl">{t.pricingPremiumPrice}</h3>
                  <p className="mt-1 text-sm text-primary-foreground/75">{t.pricingPremiumPeriod}</p>
                </div>
                <span className="rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold">{t.pricingPremium}</span>
              </div>
              <ul className="mt-8 space-y-4 text-sm text-primary-foreground/90">
                {t.pricingPremiumFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/auth"
                className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.02]"
              >
                {t.pricingCtaPremium}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
            </article>
          </div>

          <div className="mt-6 border-l-2 border-accent pl-5">
            <p className="text-sm leading-relaxed text-muted-foreground">{t.pricingPositioning}</p>
            <p className="mt-3 text-xs text-muted-foreground/80">{t.pricingNote}</p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-24" aria-labelledby="testimonials">
          <h2 id="testimonials" className="font-serif text-4xl text-foreground">
            {t.testimonialsTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">{t.testimonialsLead}</p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <figure
                key={i}
                className="rounded-3xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground"
              >
                <blockquote>{t.testimonialsEmpty}</blockquote>
              </figure>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-24" aria-labelledby="privacy">
          <div className="rounded-[2rem] border border-border bg-card p-8 shadow-soft md:p-10">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              RGPD
            </p>
            <h2 id="privacy" className="mt-4 font-serif text-4xl text-foreground">
              {t.privacyTitle}
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">{t.privacyLead}</p>
            <dl className="mt-8 grid gap-5 md:grid-cols-2">
              {t.privacyPoints.map((p) => (
                <div key={p.title} className="rounded-2xl bg-secondary/40 p-5">
                  <dt className="font-serif text-xl text-foreground">{p.title}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</dd>
                </div>
              ))}
            </dl>
            <Link
              to="/legal/confidentialite"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
            >
              {t.privacyCta}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
