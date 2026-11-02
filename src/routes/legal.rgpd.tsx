import { createFileRoute, Link } from "@tanstack/react-router";
import { Mic } from "lucide-react";
import { LegalDocView } from "@/components/LegalDocView";
import { GDPR } from "@/lib/legal-content";
import { AudioConsentSettings } from "@/components/AudioConsentSettings";
import { DataErasureForm } from "@/components/DataErasureForm";
import { frenchOnlyLinks } from "@/lib/seo-lang";

const URL = "https://alesimspeak.dev/legal/rgpd";
const DESC =
  "Finalités, bases légales, durées de conservation et droits RGPD sur ALESIM, avec la gestion directe de votre consentement audio.";

export const Route = createFileRoute("/legal/rgpd")({
  head: () => ({
    meta: [
      { title: "ALESIM — RGPD : finalités, durées et droits" },
      { name: "description", content: DESC },
      { property: "og:title", content: "ALESIM — RGPD : finalités, durées et droits" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { property: "og:image", content: "https://alesimspeak.dev/og-alesim.jpg" },
      { name: "twitter:image", content: "https://alesimspeak.dev/og-alesim.jpg" },
    ],
    links: frenchOnlyLinks("/legal/rgpd"),
  }),
  component: GdprPage,
});

function GdprPage() {
  return (
    <LegalDocView doc={GDPR}>
      <div id="consentement-audio" className="scroll-mt-6">
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <h2 className="flex items-center gap-2 font-serif text-2xl text-foreground">
            <Mic className="h-5 w-5 text-primary" />
            Gérer mon consentement audio
          </h2>
          <p className="mt-2 text-sm text-foreground/80">
            Aucune capture de votre voix ne démarre sans votre accord explicite. Vous pouvez le
            donner, le retirer, consulter le journal de vos décisions ou l'exporter ci-dessous —
            tout est stocké sur votre appareil.
          </p>
        </div>
        <AudioConsentSettings />
        <div className="mt-10">
          <DataErasureForm />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Pour les traceurs et cookies, rendez-vous sur la{" "}
          <Link to="/legal/cookies" className="underline underline-offset-2 hover:text-foreground">
            page dédiée
          </Link>
          .
        </p>
      </div>
    </LegalDocView>
  );
}
