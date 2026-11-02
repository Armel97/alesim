import { createFileRoute } from "@tanstack/react-router";
import { LegalDocView } from "@/components/LegalDocView";
import { TERMS } from "@/lib/legal-content";
import { frenchOnlyLinks } from "@/lib/seo-lang";

const URL = "https://alesimspeak.dev/legal/cgu";

export const Route = createFileRoute("/legal/cgu")({
  head: () => ({
    meta: [
      { title: "ALESIM — Conditions générales d'utilisation" },
      {
        name: "description",
        content:
          "Les CGU d'ALESIM : accès au service, fonctionnalités, obligations, propriété intellectuelle, abonnement, responsabilité et résiliation.",
      },
      { property: "og:title", content: "ALESIM — Conditions générales d'utilisation" },
      {
        property: "og:description",
        content:
          "Les CGU d'ALESIM : accès au service, fonctionnalités, obligations, propriété intellectuelle, abonnement, responsabilité et résiliation.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { property: "og:image", content: "https://alesimspeak.dev/og-alesim.jpg" },
      { name: "twitter:image", content: "https://alesimspeak.dev/og-alesim.jpg" },
    ],
    links: frenchOnlyLinks("/legal/cgu"),
  }),
  component: () => <LegalDocView doc={TERMS} />,
});
