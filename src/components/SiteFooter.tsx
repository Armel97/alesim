import { Link } from "@tanstack/react-router";
import { LEGAL_LINKS } from "@/lib/legal-content";
import { openCookiePreferences } from "@/lib/cookie-consent";

export function SiteFooter() {
  return (
    <footer className="border-t bg-card/40">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <p className="font-serif text-xl text-foreground">ALESIM</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Gagnez en confiance et en clarté à l'oral, à votre rythme.
        </p>

        <nav aria-label="Informations légales" className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Informations légales
          </h2>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0 text-sm">
            {LEGAL_LINKS.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={openCookiePreferences}
                className="inline-flex min-h-11 items-center text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Gérer les cookies
              </button>
            </li>
          </ul>
        </nav>

        <p className="mt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} ALESIM. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}
