import { createFileRoute } from "@tanstack/react-router";
import { LegalDocView } from "@/components/LegalDocView";
import { NOTICE } from "@/lib/legal-content";
import { frenchOnlyLinks } from "@/lib/seo-lang";

const URL = "https://alesimspeak.dev/legal/mentions-legales";

export const Route = createFileRoute("/legal/mentions-legales")({
  head: () => ({
    meta: [
      { title: "ALESIM — Mentions légales" },
      {
        name: "description",
        content:
          "Éditeur, directeur de publication, hébergeur et propriété intellectuelle de l'application ALESIM.",
      },
      { property: "og:title", content: "ALESIM — Mentions légales" },
      {
        property: "og:description",
        content:
          "Éditeur, directeur de publication, hébergeur et propriété intellectuelle de l'application ALESIM.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { property: "og:image", content: "https://alesimspeak.dev/og-alesim.jpg" },
      { name: "twitter:image", content: "https://alesimspeak.dev/og-alesim.jpg" },
    ],
    links: frenchOnlyLinks("/legal/mentions-legales"),
  }),
  component: () => <LegalDocView doc={NOTICE} />,
});
