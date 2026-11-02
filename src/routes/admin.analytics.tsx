import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppHeader } from "@/components/AppHeader";
import { TrackingGate } from "@/components/SoftGate";
import { FUNNEL_STEPS } from "@/lib/analytics";
import { getFunnelStats, type FunnelStats } from "@/lib/analytics.functions";
import type { SegmentFunnel } from "@/lib/analytics.functions";
import { FORM_FACTOR_LABELS, SEGMENT_LABELS } from "@/lib/device-segment";
import { useLang } from "@/lib/i18n";
import { BarChart3, Lock, Monitor, Smartphone, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/admin/analytics")({
  component: GatedAnalytics,
  head: () => ({
    meta: [
      { title: "ALESIM — Analytics du funnel" },
      {
        name: "description",
        content:
          "Mesure du parcours d'inscription ALESIM : landing, résultat, soft gate, authentification et dashboard, avec taux de conversion.",
      },
      { property: "og:title", content: "ALESIM — Analytics du funnel" },
      {
        property: "og:description",
        content: "Événements et taux de conversion du parcours d'inscription ALESIM.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://alesimspeak.dev/admin/analytics" }],
  }),
});

const RANGES = [7, 30, 90] as const;

function GatedAnalytics() {
  return (
    <TrackingGate>
      <AnalyticsPage />
    </TrackingGate>
  );
}

function AnalyticsPage() {
  const { lang } = useLang();
  const fr = lang !== "en";
  const fetchStats = useServerFn(getFunnelStats);
  const [days, setDays] = useState<number>(30);
  const [stats, setStats] = useState<FunnelStats | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "forbidden" | "error">("loading");

  useEffect(() => {
    let active = true;
    setState("loading");
    fetchStats({ data: { days } })
      .then((s) => {
        if (!active) return;
        setStats(s);
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
  }, [days, fetchStats]);

  const funnel = useMemo(() => {
    if (!stats) return [];
    const base = stats.uniques[FUNNEL_STEPS[0]!.event] ?? 0;
    let previous = base;
    return FUNNEL_STEPS.map((step, i) => {
      const value = stats.uniques[step.event] ?? 0;
      const fromPrevious = i === 0 || previous === 0 ? null : (value / previous) * 100;
      const fromStart = base === 0 ? null : (value / base) * 100;
      previous = value;
      return {
        key: step.event,
        label: fr ? step.label.fr : step.label.en,
        value,
        events: stats.counts[step.event] ?? 0,
        fromPrevious,
        fromStart,
      };
    });
  }, [stats, fr]);

  const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)} %`);

  return (
    <main className="min-h-dvh bg-background">
      <AppHeader />
      <section className="mx-auto w-full max-w-5xl px-6 pb-24 pt-4">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-accent">
              {fr ? "Mesure du funnel" : "Funnel measurement"}
            </p>
            <h1 className="mt-2 font-serif text-4xl text-foreground">
              {fr ? "Analytics d'acquisition" : "Acquisition analytics"}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {fr
                ? "Landing → résultat → soft gate → auth → dashboard. Visiteurs uniques anonymes, sans donnée personnelle."
                : "Landing → result → soft gate → auth → dashboard. Anonymous unique visitors, no personal data."}
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
            {fr
              ? "Impossible de charger les statistiques pour le moment."
              : "Unable to load statistics right now."}
          </p>
        )}

        {state === "ready" && stats && (
          <div className="mt-10 space-y-8">
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryCard
                label={fr ? "Événements" : "Events"}
                value={stats.totalEvents.toLocaleString(fr ? "fr-FR" : "en-US")}
              />
              <SummaryCard
                label={fr ? "Visiteurs uniques" : "Unique visitors"}
                value={String(stats.uniques["landing_view"] ?? 0)}
              />
              <SummaryCard
                label={fr ? "Conversion landing → compte" : "Landing → account"}
                value={pct(funnel.at(-2)?.fromStart ?? null)}
                highlight
              />
            </div>

            <article className="rounded-3xl border border-border bg-card p-6 shadow-soft">
              <h2 className="flex items-center gap-2 font-serif text-2xl text-foreground">
                <BarChart3 className="h-5 w-5" />
                {fr ? "Entonnoir de conversion" : "Conversion funnel"}
              </h2>
              <div className="mt-6 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnel} layout="vertical" margin={{ left: 24, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar
                      dataKey="value"
                      name={fr ? "Visiteurs uniques" : "Unique visitors"}
                      fill="hsl(var(--primary))"
                      radius={[0, 8, 8, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4">{fr ? "Étape" : "Step"}</th>
                      <th className="py-2 pr-4">{fr ? "Uniques" : "Uniques"}</th>
                      <th className="py-2 pr-4">{fr ? "Événements" : "Events"}</th>
                      <th className="py-2 pr-4">{fr ? "vs étape préc." : "vs previous"}</th>
                      <th className="py-2">{fr ? "vs landing" : "vs landing"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funnel.map((row) => (
                      <tr key={row.key} className="border-t border-border/60">
                        <td className="py-2 pr-4 text-foreground">{row.label}</td>
                        <td className="py-2 pr-4 font-medium text-foreground">{row.value}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{row.events}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{pct(row.fromPrevious)}</td>
                        <td className="py-2 text-muted-foreground">{pct(row.fromStart)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-3xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-serif text-2xl text-foreground">
                {fr ? "Évolution quotidienne" : "Daily trend"}
              </h2>
              <div className="mt-6 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.daily}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="landing"
                      name="Landing"
                      stroke="hsl(var(--primary))"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="result"
                      name={fr ? "Résultat" : "Result"}
                      stroke="hsl(var(--accent))"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="auth"
                      name="Auth"
                      stroke="hsl(var(--muted-foreground))"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="signup"
                      name={fr ? "Comptes" : "Signups"}
                      stroke="hsl(var(--foreground))"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>

            <div className="grid gap-6 md:grid-cols-2">
              <ListCard
                title={fr ? "Sujets choisis" : "Selected topics"}
                empty={fr ? "Aucun sujet enregistré." : "No topic recorded yet."}
                rows={stats.topics.map((t) => ({ label: t.topic, value: t.count }))}
              />
              <ListCard
                title={fr ? "Méthodes d'authentification" : "Auth methods"}
                empty={fr ? "Aucun clic enregistré." : "No click recorded yet."}
                rows={stats.methods.map((m) => ({ label: m.method, value: m.count }))}
              />
            </div>

            <SegmentSection
              fr={fr}
              title={fr ? "Funnel par système" : "Funnel by operating system"}
              subtitle={
                fr
                  ? "iOS, Android et ordinateur : repérez l'étape où chaque plateforme décroche."
                  : "iOS, Android and desktop: spot where each platform drops off."
              }
              icon={<Smartphone className="h-5 w-5" />}
              segments={stats.devices}
              labels={SEGMENT_LABELS}
            />

            <SegmentSection
              fr={fr}
              title={fr ? "Funnel par format d'écran" : "Funnel by form factor"}
              subtitle={
                fr
                  ? "Mobile, tablette et ordinateur, indépendamment du système."
                  : "Mobile, tablet and desktop, regardless of the OS."
              }
              icon={<Monitor className="h-5 w-5" />}
              segments={stats.formFactors}
              labels={FORM_FACTOR_LABELS}
            />
          </div>
        )}
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border border-border p-6 shadow-soft ${
        highlight ? "bg-gradient-warm" : "bg-card"
      }`}
    >
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-serif text-3xl text-foreground">{value}</p>
    </div>
  );
}

function ListCard({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { label: string; value: number }[];
  empty: string;
}) {
  return (
    <article className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <h2 className="font-serif text-2xl text-foreground">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-4 text-sm">
              <span className="truncate text-foreground">{r.label}</span>
              <span className="font-medium text-muted-foreground">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

type SegmentLabels = Record<string, { fr: string; en: string }>;

/** Entonnoir compare entre segments d'appareils, avec detection du plus gros decrochage. */
function SegmentSection({
  fr,
  title,
  subtitle,
  icon,
  segments,
  labels,
}: {
  fr: boolean;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  segments: SegmentFunnel[];
  labels: SegmentLabels;
}) {
  const rows = segments.filter((s) => s.visitors > 0);
  const name = (key: string) => labels[key]?.[fr ? "fr" : "en"] ?? key;

  const analysed = rows.map((seg) => {
    const base = seg.uniques[FUNNEL_STEPS[0]!.event] ?? seg.visitors;
    let previous = base;
    let worst: { label: string; loss: number } | null = null;
    const steps = FUNNEL_STEPS.map((step, i) => {
      const value = seg.uniques[step.event] ?? 0;
      const rate = i === 0 || previous === 0 ? null : (value / previous) * 100;
      if (i > 0 && previous > 0) {
        const loss = previous - value;
        if (loss > 0 && (!worst || loss > worst.loss)) {
          worst = { label: fr ? step.label.fr : step.label.en, loss };
        }
      }
      previous = value;
      return { key: step.event, label: fr ? step.label.fr : step.label.en, value, rate };
    });
    const signup = seg.uniques["signup_success"] ?? 0;
    return {
      key: seg.key,
      visitors: seg.visitors,
      steps,
      conversion: base === 0 ? null : (signup / base) * 100,
      worst: worst as { label: string; loss: number } | null,
    };
  });

  const chartData = FUNNEL_STEPS.map((step) => {
    const point: Record<string, string | number> = { label: fr ? step.label.fr : step.label.en };
    for (const seg of analysed) {
      point[name(seg.key)] = seg.steps.find((s) => s.key === step.event)?.value ?? 0;
    }
    return point;
  });

  const colors = [
    "hsl(var(--primary))",
    "hsl(var(--accent))",
    "hsl(var(--muted-foreground))",
    "hsl(var(--foreground))",
  ];

  return (
    <article className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <h2 className="flex items-center gap-2 font-serif text-2xl text-foreground">
        {icon}
        {title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>

      {analysed.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          {fr
            ? "Pas encore de données segmentées : les appareils sont enregistrés à partir des nouvelles visites."
            : "No segmented data yet: devices are recorded from new visits onward."}
        </p>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {analysed.map((seg) => (
              <div key={seg.key} className="rounded-2xl border border-border/70 bg-background p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {name(seg.key)}
                </p>
                <p className="mt-1 font-serif text-2xl text-foreground">
                  {seg.conversion === null ? "—" : `${seg.conversion.toFixed(1)} %`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fr ? "conversion vers compte" : "conversion to account"} · {seg.visitors}{" "}
                  {fr ? "visiteurs" : "visitors"}
                </p>
                {seg.worst && (
                  <p className="mt-2 flex items-start gap-1 text-xs text-destructive">
                    <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      {fr ? "Chute principale : " : "Biggest drop: "}
                      {seg.worst.label} (−{seg.worst.loss})
                    </span>
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: 8, right: 8, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                {analysed.map((seg, i) => (
                  <Bar
                    key={seg.key}
                    dataKey={name(seg.key)}
                    fill={colors[i % colors.length]}
                    radius={[6, 6, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">{fr ? "Étape" : "Step"}</th>
                  {analysed.map((seg) => (
                    <th key={seg.key} className="py-2 pr-4">
                      {name(seg.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FUNNEL_STEPS.map((step, i) => (
                  <tr key={step.event} className="border-t border-border/60">
                    <td className="py-2 pr-4 text-foreground">
                      {fr ? step.label.fr : step.label.en}
                    </td>
                    {analysed.map((seg) => {
                      const cell = seg.steps[i]!;
                      const weak = cell.rate !== null && cell.rate < 50;
                      return (
                        <td key={seg.key} className="py-2 pr-4">
                          <span className="font-medium text-foreground">{cell.value}</span>{" "}
                          <span className={weak ? "text-destructive" : "text-muted-foreground"}>
                            {cell.rate === null ? "" : `(${cell.rate.toFixed(0)} %)`}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </article>
  );
}
