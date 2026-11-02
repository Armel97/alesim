import { createFileRoute } from "@tanstack/react-router";
import { LegalDocView } from "@/components/LegalDocView";
import { PRIVACY } from "@/lib/legal-content";
import { frenchOnlyLinks } from "@/lib/seo-lang";

const URL = "https://alesimspeak.dev/legal/confidentialite";

export const Route = createFileRoute("/legal/confidentialite")({
  head: () => ({
    meta: [
      { title: "ALESIM — Politique de confidentialité" },
      {
        name: "description",
        content:
          "Comment ALESIM collecte, utilise, conserve et protège vos données : compte, progression, enregistrements audio et vidéo, CV. Conforme au RGPD.",
      },
      { property: "og:title", content: "ALESIM — Politique de confidentialité" },
      {
        property: "og:description",
        content:
          "Comment ALESIM collecte, utilise, conserve et protège vos données : compte, progression, enregistrements audio et vidéo, CV. Conforme au RGPD.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { property: "og:image", content: "https://alesimspeak.dev/og-alesim.jpg" },
      { name: "twitter:image", content: "https://alesimspeak.dev/og-alesim.jpg" },
    ],
    links: frenchOnlyLinks("/legal/confidentialite"),
  }),
  component: () => <LegalDocView doc={PRIVACY} />,
});
