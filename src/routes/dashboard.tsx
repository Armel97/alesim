import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
import { loadSessions, type Session } from "@/lib/history-store";
import { loadPronunciationSessions, type PronunciationSession } from "@/lib/pronunciation-history";
import { LEVELS, PRACTICE_LANGS, type Level } from "@/lib/language-content";
import { getProgress } from "@/lib/language-progress";
import { Mic, Languages as LanguagesIcon, Trophy, Sparkles } from "lucide-react";
import { ReminderSettings } from "@/components/ReminderSettings";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { ConfidenceProgress } from "@/components/ConfidenceProgress";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/dashboard")({
  component: GatedDashboard,
  head: () => ({
    meta: [
      { title: "ALESIM — Tableau de bord de progression" },
      {
        name: "description",
        content:
          "Suivez votre progression à l'oral : précision, fluidité, confiance, par langue et par niveau, avec graphiques et historique.",
      },
      { property: "og:title", content: "ALESIM — Tableau de bord de progression" },
      {
        property: "og:description",
        content:
          "Graphiques et historique de vos séances : précision, fluidité, confiance, par langue et par niveau.",
      },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: "https://alesimspeak.dev/dashboard" }],
  }),
});

function Dashboard() {
  const { t, lang: uiLang } = useLang();

  useEffect(() => {
    track("dashboard_view");
  }, []);

  const [speech, setSpeech] = useState<Session[]>([]);
  const [pron, setPron] = useState<PronunciationSession[]>([]);

  useEffect(() => {
    setSpeech(loadSessions());
    setPron(loadPronunciationSessions());
  }, []);

  const totals = useMemo(() => {
    const avg = (arr: number[]) =>
      arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const clarity = avg(speech.map((s) => s.feedback.clarity));
    const confidence = avg(speech.map((s) => s.feedback.confidence));
    const accuracy = avg(pron.map((s) => s.accuracy));
    const fluency = avg(pron.map((s) => s.fluency));
    return {
      clarity,
      confidence,
      accuracy,
      fluency,
      speechCount: speech.length,
      pronCount: pron.length,
      passed: pron.filter((s) => s.passed).length,
    };
  }, [speech, pron]);

  const radarData = useMemo(
    () => [
      { skill: t.accuracy, value: totals.accuracy },
      { skill: t.fluency, value: totals.fluency },
      { skill: t.clarity, value: totals.clarity },
      { skill: t.confidence, value: totals.confidence },
    ],
    [totals, t],
  );

  const timeline = useMemo(() => {
    const all = [
      ...speech.map((s) => ({
        t: s.createdAt,
        clarity: s.feedback.clarity,
        confidence: s.feedback.confidence,
      })),
      ...pron.map((s) => ({
        t: s.createdAt,
        accuracy: s.accuracy,
        fluency: s.fluency,
      })),
    ]
      .sort((a, b) => a.t - b.t)
      .map((d) => ({
        ...d,
        date: new Date(d.t).toLocaleDateString(uiLang, {
          month: "short",
          day: "numeric",
        }),
      }));
    return all;
  }, [speech, pron, uiLang]);

  const byLevel = useMemo(() => {
    return LEVELS.map((lv) => {
      const s = pron.filter((p) => p.level === lv);
      const avg = (arr: number[]) =>
        arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
      return {
        level: t.levels[lv],
        [t.accuracy]: avg(s.map((x) => x.accuracy)),
        [t.fluency]: avg(s.map((x) => x.fluency)),
      };
    });
  }, [pron, t]);

  const byLanguage = useMemo(() => {
    return PRACTICE_LANGS.map((l) => {
      let completed = 0;
      for (const lv of LEVELS) completed += getProgress(l.code, lv).completed.length;
      return {
        language: uiLang === "fr" ? l.labelFr : l.labelEn,
        flag: l.flag,
        completed,
      };
    });
  }, [uiLang, pron]);

  const hasAny = speech.length + pron.length > 0;

  return (
    <main className="min-h-dvh bg-background">
      <AppHeader />
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-accent">{t.dashboard}</p>
          <h1 className="mt-3 font-serif text-5xl leading-tight text-foreground md:text-6xl">
            {t.dashboardTitle}
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">{t.dashboardLead}</p>
        </div>

        {!hasAny ? (
          <div className="rounded-3xl border border-dashed p-12 text-center text-muted-foreground">
            {t.noData}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard
                icon={<Sparkles className="h-4 w-4" />}
                label={t.accuracy}
                value={totals.accuracy}
                suffix="/100"
              />
              <StatCard
                icon={<Sparkles className="h-4 w-4" />}
                label={t.fluency}
                value={totals.fluency}
                suffix="/100"
              />
              <StatCard
                icon={<Mic className="h-4 w-4" />}
                label={t.confidence}
                value={totals.confidence}
                suffix="/100"
              />
              <StatCard
                icon={<Trophy className="h-4 w-4" />}
                label={t.sessions}
                value={totals.speechCount + totals.pronCount}
                suffix=""
              />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
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
                        dataKey="value"
                        stroke="hsl(var(--accent))"
                        fill="hsl(var(--accent))"
                        fillOpacity={0.35}
                      />
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

              <Card title={t.overTime}>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeline}>
                      <defs>
                        <linearGradient id="gAcc" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gConf" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
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
                      <Area
                        type="monotone"
                        dataKey="accuracy"
                        name={t.accuracy}
                        stroke="hsl(var(--accent))"
                        fill="url(#gAcc)"
                        connectNulls
                      />
                      <Area
                        type="monotone"
                        dataKey="fluency"
                        name={t.fluency}
                        stroke="hsl(var(--accent))"
                        strokeDasharray="4 3"
                        fillOpacity={0}
                        connectNulls
                      />
                      <Area
                        type="monotone"
                        dataKey="confidence"
                        name={t.confidence}
                        stroke="hsl(var(--primary))"
                        fill="url(#gConf)"
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title={t.byLevel}>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byLevel}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="level"
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
                      <Bar dataKey={t.accuracy} fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
                      <Bar dataKey={t.fluency} fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title={t.byLanguage}>
                <ul className="space-y-3">
                  {byLanguage.map((l) => {
                    const max = Math.max(1, ...byLanguage.map((x) => x.completed));
                    const pct = Math.round((l.completed / max) * 100);
                    return (
                      <li key={l.language} className="flex items-center gap-3">
                        <span className="w-6 text-lg">{l.flag}</span>
                        <span className="w-24 text-sm text-foreground">{l.language}</span>
                        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-accent transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs text-muted-foreground">
                          {l.completed}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </div>

            <div className="mt-8">
              <ActivityTimeline />
            </div>

            <div className="mt-8">
              <ConfidenceProgress />
            </div>

            <div className="mt-8">
              <ReminderSettings />
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix: string;
}) {
  return (
    <div className="rounded-3xl border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-serif text-4xl text-foreground">{value}</span>
        <span className="text-sm text-muted-foreground">{suffix}</span>
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

function RecentList({
  speech,
  pron,
  uiLang,
  labels,
}: {
  speech: Session[];
  pron: PronunciationSession[];
  uiLang: "fr" | "en";
  labels: {
    speaking: string;
    pronunciation: string;
    accuracy: string;
    fluency: string;
    clarity: string;
    confidence: string;
    levels: Record<string, string>;
  };
}) {
  const items = [
    ...speech.map((s) => ({
      id: s.id,
      t: s.createdAt,
      kind: "speech" as const,
      text: s.transcript,
      metrics: [
        { label: labels.clarity, value: s.feedback.clarity },
        { label: labels.confidence, value: s.feedback.confidence },
      ],
      tag: labels.speaking,
    })),
    ...pron.map((s) => ({
      id: s.id,
      t: s.createdAt,
      kind: "pron" as const,
      text: s.reference,
      metrics: [
        { label: labels.accuracy, value: s.accuracy },
        { label: labels.fluency, value: s.fluency },
      ],
      tag: `${labels.pronunciation} · ${labels.levels[s.level]} · ${s.lang.toUpperCase()}`,
    })),
  ]
    .sort((a, b) => b.t - a.t)
    .slice(0, 10);

  return (
    <ul className="divide-y divide-border">
      {items.map((it) => (
        <li key={it.id} className="flex items-start justify-between gap-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {it.kind === "pron" ? (
                <LanguagesIcon className="h-3 w-3" />
              ) : (
                <Mic className="h-3 w-3" />
              )}
              <span>{it.tag}</span>
              <span>·</span>
              <span>{new Date(it.t).toLocaleString(uiLang)}</span>
            </div>
            <p className="mt-1 truncate font-serif text-lg text-foreground">
              &ldquo;{it.text}&rdquo;
            </p>
          </div>
          <div className="flex shrink-0 gap-2 text-xs">
            {it.metrics.map((m) => (
              <span
                key={m.label}
                className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground"
              >
                {m.label}: <span className="font-medium">{m.value}</span>
              </span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function GatedDashboard() {
  return (
    <TrackingGate>
      <Dashboard />
    </TrackingGate>
  );
}
