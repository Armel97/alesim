import { createFileRoute } from "@tanstack/react-router";
import { LegalDocView } from "@/components/LegalDocView";
import { COOKIES } from "@/lib/legal-content";
import { frenchOnlyLinks } from "@/lib/seo-lang";

const URL = "https://alesimspeak.dev/legal/cookies";

export const Route = createFileRoute("/legal/cookies")({
  head: () => ({
    meta: [
      { title: "ALESIM — Gestion des cookies" },
      {
        name: "description",
        content:
          "Les traceurs utilisés par ALESIM, leur finalité, leur durée, et comment modifier vos préférences de cookies à tout moment.",
      },
      { property: "og:title", content: "ALESIM — Gestion des cookies" },
      {
        property: "og:description",
        content:
          "Les traceurs utilisés par ALESIM, leur finalité, leur durée, et comment modifier vos préférences de cookies à tout moment.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { property: "og:image", content: "https://alesimspeak.dev/og-alesim.jpg" },
      { name: "twitter:image", content: "https://alesimspeak.dev/og-alesim.jpg" },
    ],
    links: frenchOnlyLinks("/legal/cookies"),
  }),
  component: () => <LegalDocView doc={COOKIES} />,
});
