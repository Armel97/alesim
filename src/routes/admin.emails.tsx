import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppHeader } from "@/components/AppHeader";
import { getEmailDiagnostics, type EmailDiagnostics } from "@/lib/email-diagnostics.functions";
import { useLang } from "@/lib/i18n";
import { Lock, MailWarning } from "lucide-react";

export const Route = createFileRoute("/admin/emails")({
  component: EmailDiagnosticsPage,
  head: () => ({
    meta: [
      { title: "ALESIM — Diagnostic des e-mails" },
      {
        name: "description",
        content:
          "Journal de livraison des e-mails ALESIM : envois, rejets, rebonds, plaintes, désinscriptions et réessais automatiques.",
      },
      { property: "og:title", content: "ALESIM — Diagnostic des e-mails" },
      {
        property: "og:description",
        content: "Suivi des envois, rejets et rebonds d'e-mails ALESIM pour diagnostic.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://alesimspeak.dev/admin/emails" }],
  }),
});

const RANGES = [7, 14, 30] as const;

const TONE: Record<string, string> = {
  sent: "bg-secondary text-foreground",
  bounced: "bg-destructive/10 text-destructive",
  complained: "bg-destructive/10 text-destructive",
  rejected: "bg-destructive/10 text-destructive",
  send_failed: "bg-destructive/10 text-destructive",
  send_retry: "bg-accent/15 text-accent",
  rate_limited: "bg-accent/15 text-accent",
  suppressed: "bg-muted text-muted-foreground",
  unsubscribed: "bg-muted text-muted-foreground",
};

function maskRecipient(value: string | null): string {
  if (!value) return "—";
  const [user = "", domain = ""] = value.split("@");
  const head = user.slice(0, 2);
  return `${head}${"•".repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

function EmailDiagnosticsPage() {
  const { lang } = useLang();
  const fr = lang !== "en";
  const fetchDiagnostics = useServerFn(getEmailDiagnostics);
  const [days, setDays] = useState<number>(14);
  const [data, setData] = useState<EmailDiagnostics | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "forbidden" | "error">("loading");

  useEffect(() => {
    let active = true;
    setState("loading");
    fetchDiagnostics({ data: { days } })
      .then((d) => {
        if (!active) return;
        setData(d);
        setState("ready");
      })
      .catch((err: unknown) => {
        if (!active) return;
        const status = (err as { status?: number })?.status;
        setState(status === 403 ? "forbidden" : "error");
      });
    return () => {
      active = false;
    };
  }, [days, fetchDiagnostics]);

  return (
    <main className="min-h-dvh bg-background">
      <AppHeader />
      <section className="mx-auto w-full max-w-5xl px-6 pb-24 pt-4">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-accent">
              {fr ? "Livraison e-mail" : "Email delivery"}
            </p>
            <h1 className="mt-2 font-serif text-4xl text-foreground">
              {fr ? "Diagnostic des envois" : "Send diagnostics"}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {fr
                ? "Envois, réessais automatiques, rejets, rebonds et plaintes. Les adresses sont masquées."
                : "Sends, automatic retries, rejections, bounces and complaints. Addresses are masked."}
            </p>
          </div>
          <div className="flex gap-1 rounded-full bg-secondary p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDays(r)}
                className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors ${
                  days === r
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r} {fr ? "j" : "d"}
              </button>
            ))}
          </div>
        </header>

        {state === "loading" && (
          <div className="mt-10 h-64 animate-pulse rounded-3xl bg-secondary/60" />
        )}

        {state === "forbidden" && (
          <div className="mt-10 rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <Lock className="h-6 w-6" />
            </span>
            <h2 className="mt-4 font-serif text-2xl text-foreground">
              {fr ? "Accès réservé" : "Restricted access"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {fr
                ? "Cette page est réservée aux comptes administrateurs d'ALESIM."
                : "This page is restricted to ALESIM administrator accounts."}
            </p>
          </div>
        )}

        {state === "error" && (
          <p className="mt-10 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            {fr ? "Impossible de charger le journal." : "Unable to load the log right now."}
          </p>
        )}

        {state === "ready" && data && (
          <div className="mt-10 space-y-6">
            <div className="grid gap-3 sm:grid-cols-4">
              {Object.entries(data.counts).length === 0 && (
                <p className="text-sm text-muted-foreground sm:col-span-4">
                  {fr
                    ? "Aucun événement sur la période. Les envois de test n'apparaissent pas dans le journal."
                    : "No events for this period. Test sends are not recorded."}
                </p>
              )}
              {Object.entries(data.counts).map(([key, value]) => (
                <div key={key} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{key}</p>
                  <p className="mt-1 font-serif text-2xl text-foreground">{value}</p>
                </div>
              ))}
            </div>

            {data.platformError && (
              <p className="flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {fr
                  ? "Journal plateforme indisponible pour le moment ; seules les entrées applicatives sont affichées."
                  : "Platform log unavailable right now; only app-side entries are shown."}
              </p>
            )}

            <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-soft">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">{fr ? "Date" : "Date"}</th>
                    <th className="px-4 py-3">{fr ? "Événement" : "Event"}</th>
                    <th className="px-4 py-3">{fr ? "Motif" : "Reason"}</th>
                    <th className="px-4 py-3">{fr ? "Destinataire" : "Recipient"}</th>
                    <th className="px-4 py-3">{fr ? "Source" : "Source"}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, i) => (
                    <tr key={`${row.messageId ?? "row"}-${i}`} className="border-t border-border">
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {new Date(row.occurredAt).toLocaleString(fr ? "fr-FR" : "en-US")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            TONE[row.eventType] ?? "bg-secondary text-foreground"
                          }`}
                        >
                          {row.eventType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.status ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {maskRecipient(row.recipient)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.source === "app" ? (fr ? "app" : "app") : fr ? "plateforme" : "platform"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
