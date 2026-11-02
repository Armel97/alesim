import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { LEGAL_LINKS, formatUpdatedAt, type LegalDoc } from "@/lib/legal-content";
import { SiteFooter } from "@/components/SiteFooter";

export function LegalDocView({ doc, children }: { doc: LegalDoc; children?: React.ReactNode }) {
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
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Informations légales
        </p>
        <h1 className="mt-2 font-serif text-4xl text-foreground">{doc.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{doc.lead}</p>
        <p className="mt-4 inline-flex rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
          Dernière mise à jour le {formatUpdatedAt(doc.updatedAt)}
        </p>

        <nav aria-label="Sommaire" className="mt-8 rounded-2xl border bg-card p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sommaire
          </h2>
          <ul className="mt-1 text-sm">
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground"
                >
                  {s.heading}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-10 space-y-10">
          {doc.sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-6">
              <h2 className="font-serif text-2xl text-foreground">{s.heading}</h2>
              <div className="mt-3 space-y-4">
                {s.blocks.map((b, i) => {
                  if (b.type === "p")
                    return (
                      <p key={i} className="text-sm leading-relaxed text-foreground/80">
                        {b.text}
                      </p>
                    );
                  if (b.type === "ul")
                    return (
                      <ul
                        key={i}
                        className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground/80"
                      >
                        {b.items.map((it, j) => (
                          <li key={j}>{it}</li>
                        ))}
                      </ul>
                    );
                  return (
                    <div key={i} className="overflow-x-auto rounded-xl border">
                      <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                        <thead className="bg-secondary/60">
                          <tr>
                            {b.head.map((h) => (
                              <th key={h} className="px-3 py-2 font-medium text-foreground">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {b.rows.map((row, ri) => (
                            <tr key={ri} className="border-t align-top">
                              {row.map((cell, ci) => (
                                <td key={ci} className="px-3 py-2 text-foreground/80">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {children ? <div className="mt-12">{children}</div> : null}

        <nav aria-label="Autres pages légales" className="mt-12 flex flex-wrap gap-2">
          {LEGAL_LINKS.filter((l) => !l.to.endsWith(doc.slug)).map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="inline-flex min-h-11 items-center rounded-full border px-4 text-sm text-muted-foreground hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </main>

      <SiteFooter />
    </div>
  );
}
