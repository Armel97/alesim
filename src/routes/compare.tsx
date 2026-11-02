import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrackingGate } from "@/components/SoftGate";
import { AppHeader } from "@/components/AppHeader";
import { useLang } from "@/lib/i18n";
import { loadPronunciationSessions, type PronunciationSession } from "@/lib/pronunciation-history";
import { PRACTICE_LANGS, type PracticeLang } from "@/lib/language-content";
import { ArrowRight } from "lucide-react";
import { HesitationTimeline } from "@/components/HesitationTimeline";
import { Download } from "lucide-react";
import { buildComparePdf } from "@/lib/compare-pdf";

export const Route = createFileRoute("/compare")({
  component: GatedCompare,
  head: () => ({
    meta: [
      { title: "ALESIM — Comparez vos langues" },
      {
        name: "description",
        content:
          "Comparez côte à côte votre précision, fluidité et confiance entre deux langues sur la même période.",
      },
      { property: "og:title", content: "ALESIM — Comparez vos langues" },
      {
        property: "og:description",
        content:
          "Vue comparative de vos performances entre deux langues : précision, fluidité, confiance.",
      },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: "https://alesimspeak.dev/compare" }],
  }),
});

type Period = "7" | "30" | "90" | "all";
type TimelineFilter = "all" | "speech" | "pause" | "filler";

function Compare() {
  const { t, lang: uiLang } = useLang();
  const [pron, setPron] = useState<PronunciationSession[]>([]);
  const [langA, setLangA] = useState<PracticeLang>("en");
  const [langB, setLangB] = useState<PracticeLang>("es");
  const [period, setPeriod] = useState<Period>("30");
  const [tlFilter, setTlFilter] = useState<TimelineFilter>("all");

  useEffect(() => {
    setPron(loadPronunciationSessions());
  }, []);

  const since = useMemo(() => {
    if (period === "all") return 0;
    const days = Number(period);
    return Date.now() - days * 24 * 60 * 60 * 1000;
  }, [period]);

  const scoped = useMemo(() => pron.filter((s) => s.createdAt >= since), [pron, since]);

  const statsFor = (code: PracticeLang) => {
    const arr = scoped.filter((s) => s.lang === code);
    const avg = (xs: number[]) =>
      xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;
    const accuracy = avg(arr.map((s) => s.accuracy));
    const fluency = avg(arr.map((s) => s.fluency));
    const confidence = arr.length
      ? Math.round((arr.filter((s) => s.passed).length / arr.length) * 100)
      : 0;
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    const fillerTotal = sum(arr.map((s) => s.fillerCount ?? 0));
    const pauseTotal = sum(arr.map((s) => s.pauseCount ?? 0));
    const pauseSecTotal = sum(arr.map((s) => s.pauseSec ?? 0));
    const durationTotal = sum(arr.map((s) => s.durationSec ?? 0));
    const minutes = durationTotal / 60;
    const fillerPerMin = minutes > 0 ? +(fillerTotal / minutes).toFixed(1) : 0;
    const pausePerMin = minutes > 0 ? +(pauseTotal / minutes).toFixed(1) : 0;
    const pauseSecPerMin = minutes > 0 ? +(pauseSecTotal / minutes).toFixed(1) : 0;
    return {
      count: arr.length,
      accuracy,
      fluency,
      confidence,
      arr,
      fillerTotal,
      pauseTotal,
      pauseSecTotal: +pauseSecTotal.toFixed(1),
      fillerPerMin,
      pausePerMin,
      pauseSecPerMin,
      durationTotal: +durationTotal.toFixed(1),
    };
  };

  const a = useMemo(() => statsFor(langA), [scoped, langA]);
  const b = useMemo(() => statsFor(langB), [scoped, langB]);

  const latestWithTimeline = (arr: PronunciationSession[]) =>
    arr.find((s) => Array.isArray(s.timeline) && s.timeline.length > 0);
  const latestA = useMemo(() => latestWithTimeline(a.arr), [a.arr]);
  const latestB = useMemo(() => latestWithTimeline(b.arr), [b.arr]);

  const labelOf = (code: PracticeLang) => {
    const l = PRACTICE_LANGS.find((x) => x.code === code)!;
    return { name: uiLang === "fr" ? l.labelFr : l.labelEn, flag: l.flag };
  };
  const lblA = labelOf(langA);
  const lblB = labelOf(langB);

  const radarData = [
    { skill: t.accuracy, A: a.accuracy, B: b.accuracy },
    { skill: t.fluency, A: a.fluency, B: b.fluency },
    { skill: t.confidence, A: a.confidence, B: b.confidence },
  ];

  const barData = [
    { skill: t.accuracy, [lblA.name]: a.accuracy, [lblB.name]: b.accuracy },
    { skill: t.fluency, [lblA.name]: a.fluency, [lblB.name]: b.fluency },
    { skill: t.confidence, [lblA.name]: a.confidence, [lblB.name]: b.confidence },
  ];

  const hesitationBarData = [
    {
      metric: t.fillerWords,
      [lblA.name]: a.fillerPerMin,
      [lblB.name]: b.fillerPerMin,
    },
    {
      metric: t.pauses,
      [lblA.name]: a.pausePerMin,
      [lblB.name]: b.pausePerMin,
    },
    {
      metric: t.pauseTime,
      [lblA.name]: a.pauseSecPerMin,
      [lblB.name]: b.pauseSecPerMin,
    },
  ];

  const timeline = useMemo(() => {
    const dayKey = (ts: number) => new Date(ts).toISOString().slice(0, 10);
    const map = new Map<string, { date: string; ts: number; accA: number[]; accB: number[] }>();
    const push = (s: PronunciationSession, which: "A" | "B") => {
      const key = dayKey(s.createdAt);
      const entry = map.get(key) ?? { date: key, ts: new Date(key).getTime(), accA: [], accB: [] };
      if (which === "A") entry.accA.push(s.accuracy);
      else entry.accB.push(s.accuracy);
      map.set(key, entry);
    };
    a.arr.forEach((s) => push(s, "A"));
    b.arr.forEach((s) => push(s, "B"));
    return [...map.values()]
      .sort((x, y) => x.ts - y.ts)
      .map((e) => ({
        date: new Date(e.ts).toLocaleDateString(uiLang, {
          month: "short",
          day: "numeric",
        }),
        [lblA.name]: e.accA.length
          ? Math.round(e.accA.reduce((x, y) => x + y, 0) / e.accA.length)
          : null,
        [lblB.name]: e.accB.length
          ? Math.round(e.accB.reduce((x, y) => x + y, 0) / e.accB.length)
          : null,
      }));
  }, [a, b, uiLang, lblA.name, lblB.name]);

  const periods: { id: Period; label: string }[] = [
    { id: "7", label: t.last7 },
    { id: "30", label: t.last30 },
    { id: "90", label: t.last90 },
    { id: "all", label: t.allTime },
  ];

  const periodLabel = periods.find((p) => p.id === period)?.label ?? String(period);

  const handleExportPdf = () => {
    const doc = buildComparePdf({
      lang: uiLang,
      periodLabel,
      a: { name: lblA.name, flag: lblA.flag, stats: a },
      b: { name: lblB.name, flag: lblB.flag, stats: b },
      labels: {
        reportTitle: t.reportTitle,
        exportedOn: t.exportedOn,
        period: t.period,
        summary: t.summary,
        metric: t.metric,
        accuracy: t.accuracy,
        fluency: t.fluency,
        confidence: t.confidence,
        sessions: t.sessions,
        hesitations: t.hesitations,
        fillerWords: t.fillerWords,
        pauses: t.pauses,
        pauseTime: t.pauseTime,
        perMinute: t.perMinute,
        total: t.total,
        seconds: t.seconds,
        generatedBy: t.generatedBy,
      },
    });
    const stamp = new Date().toISOString().slice(0, 10);
    doc.save(`alesim-compare-${langA}-vs-${langB}-${stamp}.pdf`);
  };

  return (
    <main className="min-h-dvh bg-background">
      <AppHeader />
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-accent">{t.compare}</p>
              <h1 className="mt-3 font-serif text-5xl leading-tight text-foreground md:text-6xl">
                {t.compareTitle}
              </h1>
              <p className="mt-3 max-w-xl text-muted-foreground">{t.compareLead}</p>
            </div>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={a.count === 0 && b.count === 0}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              {t.exportPdf}
            </button>
          </div>
        </div>

        <div className="grid gap-4 rounded-3xl border bg-card p-5 shadow-soft md:grid-cols-3">
          <LangPicker label={t.languageA} value={langA} onChange={setLangA} uiLang={uiLang} />
          <LangPicker label={t.languageB} value={langB} onChange={setLangB} uiLang={uiLang} />
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              {t.period}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {periods.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    period === p.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <SideCard side="A" flag={lblA.flag} name={lblA.name} stats={a} labels={t} />
          <SideCard side="B" flag={lblB.flag} name={lblB.name} stats={b} labels={t} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card title={t.skills}>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="75%">
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis
                    dataKey="skill"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <Radar
                    name={lblA.name}
                    dataKey="A"
                    stroke="hsl(var(--accent))"
                    fill="hsl(var(--accent))"
                    fillOpacity={0.35}
                  />
                  <Radar
                    name={lblB.name}
                    dataKey="B"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.25}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title={t.skills}>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="skill"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey={lblA.name} fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey={lblB.name} fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="lg:col-span-2">
            <Card title={t.overTime}>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey={lblA.name}
                      stroke="hsl(var(--accent))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey={lblB.name}
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>

        <div className="mt-10">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <div>
              <h2 className="font-serif text-3xl text-foreground">{t.hesitations}</h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">{t.hesitationsLead}</p>
            </div>
            <span className="hidden shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground md:inline">
              {t.lessIsBetter}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <HesitationCard side="A" flag={lblA.flag} name={lblA.name} stats={a} labels={t} />
            <HesitationCard side="B" flag={lblB.flag} name={lblB.name} stats={b} labels={t} />
          </div>

          <div className="mt-6">
            <Card title={`${t.hesitations} — ${t.perMinute}`}>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hesitationBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="metric"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey={lblA.name} fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
                    <Bar dataKey={lblB.name} fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>

        <div className="mt-10">
          <div className="mb-4">
            <h2 className="font-serif text-3xl text-foreground">{t.timeline}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.timelineLead}</p>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              {t.filterOnly}
            </span>
            {(
              [
                { id: "all", label: t.filterAll },
                { id: "speech", label: t.speechEvent },
                { id: "pause", label: t.pauseEvent },
                { id: "filler", label: t.fillerEvent },
              ] as { id: TimelineFilter; label: string }[]
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTlFilter(f.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  tlFilter === f.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <TimelinePanel
              side="A"
              flag={lblA.flag}
              name={lblA.name}
              session={latestA}
              color="bg-accent"
              filter={tlFilter}
              labels={t}
            />
            <TimelinePanel
              side="B"
              flag={lblB.flag}
              name={lblB.name}
              session={latestB}
              color="bg-primary"
              filter={tlFilter}
              labels={t}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function TimelinePanel({
  side,
  flag,
  name,
  session,
  color,
  filter,
  labels,
}: {
  side: "A" | "B";
  flag: string;
  name: string;
  session: PronunciationSession | undefined;
  color: string;
  filter: TimelineFilter;
  labels: {
    latestRecording: string;
    noTimeline: string;
    zoom: string;
    fullTimeline: string;
    segment: string;
    seconds: string;
    fillerEvent: string;
    pauseEvent: string;
    speechEvent: string;
  };
}) {
  const dot = side === "A" ? "bg-accent" : "bg-primary";
  return (
    <div className="rounded-3xl border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <span className="text-2xl">{flag}</span>
        <h3 className="font-serif text-2xl text-foreground">{name}</h3>
      </div>
      {!session || !session.timeline?.length ? (
        <p className="mt-4 text-sm text-muted-foreground">{labels.noTimeline}</p>
      ) : (
        <>
          <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
            {labels.latestRecording} · {new Date(session.createdAt).toLocaleString()}
          </p>
          <p className="mt-1 text-sm italic text-muted-foreground">"{session.reference}"</p>
          <div className="mt-4">
            <HesitationTimeline
              events={session.timeline}
              durationSec={session.durationSec ?? 0}
              color={color}
              filter={filter}
              labels={{
                filler: labels.fillerEvent,
                pause: labels.pauseEvent,
                speech: labels.speechEvent,
                zoom: labels.zoom,
                reset: labels.fullTimeline,
                seconds: labels.seconds,
                segment: labels.segment,
                empty: labels.noTimeline,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function HesitationCard({
  side,
  flag,
  name,
  stats,
  labels,
}: {
  side: "A" | "B";
  flag: string;
  name: string;
  stats: {
    count: number;
    fillerTotal: number;
    pauseTotal: number;
    pauseSecTotal: number;
    fillerPerMin: number;
    pausePerMin: number;
    pauseSecPerMin: number;
  };
  labels: {
    fillerWords: string;
    pauses: string;
    pauseTime: string;
    perMinute: string;
    seconds: string;
    noSessionsPeriod: string;
  };
}) {
  const dot = side === "A" ? "bg-accent" : "bg-primary";
  return (
    <div className="rounded-3xl border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <span className="text-2xl">{flag}</span>
        <h3 className="font-serif text-2xl text-foreground">{name}</h3>
      </div>
      {stats.count === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{labels.noSessionsPeriod}</p>
      ) : (
        <div className="mt-5 grid grid-cols-3 gap-3">
          <HesitationMetric
            label={labels.fillerWords}
            total={stats.fillerTotal}
            rate={`${stats.fillerPerMin} / ${labels.perMinute}`}
          />
          <HesitationMetric
            label={labels.pauses}
            total={stats.pauseTotal}
            rate={`${stats.pausePerMin} / ${labels.perMinute}`}
          />
          <HesitationMetric
            label={labels.pauseTime}
            total={`${stats.pauseSecTotal}${labels.seconds}`}
            rate={`${stats.pauseSecPerMin}${labels.seconds} / ${labels.perMinute}`}
          />
        </div>
      )}
    </div>
  );
}

function HesitationMetric({
  label,
  total,
  rate,
}: {
  label: string;
  total: number | string;
  rate: string;
}) {
  return (
    <div className="rounded-2xl bg-secondary/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-3xl text-foreground">{total}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{rate}</p>
    </div>
  );
}

function LangPicker({
  label,
  value,
  onChange,
  uiLang,
}: {
  label: string;
  value: PracticeLang;
  onChange: (v: PracticeLang) => void;
  uiLang: "fr" | "en";
}) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {PRACTICE_LANGS.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => onChange(l.code)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              value === l.code
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{l.flag}</span>
            <span>{uiLang === "fr" ? l.labelFr : l.labelEn}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SideCard({
  side,
  flag,
  name,
  stats,
  labels,
}: {
  side: "A" | "B";
  flag: string;
  name: string;
  stats: { count: number; accuracy: number; fluency: number; confidence: number };
  labels: {
    accuracy: string;
    fluency: string;
    confidence: string;
    sessions: string;
    noSessionsPeriod: string;
  };
}) {
  const dot = side === "A" ? "bg-accent" : "bg-primary";
  return (
    <div className="rounded-3xl border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <span className="text-2xl">{flag}</span>
        <h2 className="font-serif text-2xl text-foreground">{name}</h2>
        <span className="ml-auto rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
          {stats.count} {labels.sessions.toLowerCase()}
        </span>
      </div>
      {stats.count === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{labels.noSessionsPeriod}</p>
      ) : (
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Metric label={labels.accuracy} value={stats.accuracy} />
          <Metric label={labels.fluency} value={stats.fluency} />
          <Metric label={labels.confidence} value={stats.confidence} />
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-secondary/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-3xl text-foreground">{value}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
        <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border bg-card p-6 shadow-soft">
      <p className="mb-4 text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

// keep import used for potential future header
void ArrowRight;

function GatedCompare() {
  return (
    <TrackingGate>
      <Compare />
    </TrackingGate>
  );
}
