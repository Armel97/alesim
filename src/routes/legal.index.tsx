import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Cookie, FileText, Scale, ShieldCheck, Mic } from "lucide-react";
import { LEGAL_DOCS, formatUpdatedAt } from "@/lib/legal-content";
import { openCookiePreferences } from "@/lib/cookie-consent";
import { SiteFooter } from "@/components/SiteFooter";
import { frenchOnlyLinks } from "@/lib/seo-lang";

const URL = "https://alesimspeak.dev/legal";
const DESC =
  "Politique de confidentialité, CGU, gestion des cookies et mentions légales de l'application ALESIM.";

export const Route = createFileRoute("/legal/")({
  head: () => ({
    meta: [
      { title: "ALESIM — Informations légales" },
      { name: "description", content: DESC },
      { property: "og:title", content: "ALESIM — Informations légales" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { property: "og:image", content: "https://alesimspeak.dev/og-alesim.jpg" },
      { name: "twitter:image", content: "https://alesimspeak.dev/og-alesim.jpg" },
    ],
    links: frenchOnlyLinks("/legal"),
  }),
  component: LegalIndex,
});

const CARDS = [
  { doc: LEGAL_DOCS.confidentialite, to: "/legal/confidentialite", Icon: ShieldCheck },
  { doc: LEGAL_DOCS.rgpd, to: "/legal/rgpd", Icon: Mic },
  { doc: LEGAL_DOCS.cgu, to: "/legal/cgu", Icon: FileText },
  { doc: LEGAL_DOCS.cookies, to: "/legal/cookies", Icon: Cookie },
  { doc: LEGAL_DOCS["mentions-legales"], to: "/legal/mentions-legales", Icon: Scale },
] as const;

function LegalIndex() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center font-serif text-2xl text-foreground"
        >
          ALESIM
        </Link>
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
        <h1 className="font-serif text-4xl text-foreground">Informations légales</h1>
        <p className="mt-3 text-sm text-muted-foreground">{DESC}</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {CARDS.map(({ doc, to, Icon }) => (
            <Link
              key={to}
              to={to}
              className="rounded-2xl border bg-card p-5 transition-colors hover:border-foreground/30"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-3 font-serif text-xl text-foreground">{doc.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{doc.lead}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                Mise à jour le {formatUpdatedAt(doc.updatedAt)}
              </p>
            </Link>
          ))}
        </div>

        <button
          type="button"
          onClick={openCookiePreferences}
          className="mt-6 min-h-11 rounded-full border px-5 py-2.5 text-sm font-medium hover:bg-secondary"
        >
          Gérer mes préférences cookies
        </button>
      </main>

      <SiteFooter />
    </div>
  );
}
