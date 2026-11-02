import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Flame, Sparkles, Timer, Trophy } from "lucide-react";
import { getConfidenceStats } from "@/lib/content.functions";
import { useLang } from "@/lib/i18n";

type Row = {
  viewedAt: string;
  contentId: string;
  theme: "breathing" | "articulation" | "confidence";
  level: "beginner" | "intermediate" | "advanced";
  durationMin: number;
};

const LEVELS = ["beginner", "intermediate", "advanced"] as const;
const MASTERY_THRESHOLD = 3; // distinct exercises per level to count as mastered

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return x;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function ConfidenceProgress() {
  const { t, lang } = useLang();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getConfidenceStats();
        setRows(data);
      } catch {
        setRows([]);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    const list = rows ?? [];
    // Total time
    const totalMin = list.reduce((s, r) => s + (r.durationMin || 0), 0);
    // Mastered levels: level considered mastered if user has ≥ MASTERY_THRESHOLD distinct contents at that level
    const byLevel = new Map<string, Set<string>>();
    for (const r of list) {
      if (!byLevel.has(r.level)) byLevel.set(r.level, new Set());
      byLevel.get(r.level)!.add(r.contentId);
    }
    const masteredCount = LEVELS.filter(
      (lv) => (byLevel.get(lv)?.size ?? 0) >= MASTERY_THRESHOLD,
    ).length;
    // Streak: consecutive days ending today (or yesterday) with ≥1 view
    const days = new Set(list.map((r) => dayKey(new Date(r.viewedAt))));
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    if (!days.has(dayKey(cursor))) {
      // grant grace: start from yesterday if today empty but yesterday active
      cursor.setDate(cursor.getDate() - 1);
      if (!days.has(dayKey(cursor))) return { totalMin, masteredCount, streak: 0, byLevel };
    }
    while (days.has(dayKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return { totalMin, masteredCount, streak, byLevel };
  }, [rows]);

  const weekly = useMemo(() => {
    const buckets: Array<{
      key: string;
      label: string;
      breathing: number;
      articulation: number;
      guided: number;
      minutes: number;
      ts: number;
    }> = [];
    const now = new Date();
    const monday = startOfWeek(now);
    for (let i = 7; i >= 0; i--) {
      const start = new Date(monday);
      start.setDate(monday.getDate() - i * 7);
      buckets.push({
        key: dayKey(start),
        label: start.toLocaleDateString(lang, { month: "short", day: "numeric" }),
        breathing: 0,
        articulation: 0,
        guided: 0,
        minutes: 0,
        ts: start.getTime(),
      });
    }
    for (const r of rows ?? []) {
      const wk = startOfWeek(new Date(r.viewedAt));
      const b = buckets.find((x) => x.key === dayKey(wk));
      if (!b) continue;
      if (r.theme === "confidence") b.guided += 1;
      else b[r.theme] += 1;
      b.minutes += r.durationMin || 0;
    }
    return buckets;
  }, [rows, lang]);

  const isEmpty = rows !== null && rows.length === 0;

  return (
    <div className="rounded-3xl border bg-card p-6 shadow-soft">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-accent">
            <Sparkles className="h-3 w-3" />
            {t.confidenceProgress}
          </p>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">{t.confidenceProgressLead}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MiniStat
          icon={<Trophy className="h-4 w-4" />}
          label={t.masteredLevels}
          value={`${stats.masteredCount}/3`}
          hint={LEVELS.map((lv) => t.levels[lv]).join(" · ")}
        />
        <MiniStat
          icon={<Flame className="h-4 w-4" />}
          label={t.confidenceStreak}
          value={String(stats.streak)}
          hint={t.streak}
        />
        <MiniStat
          icon={<Timer className="h-4 w-4" />}
          label={t.totalPracticeTime}
          value={`${stats.totalMin} ${t.minutesShort}`}
          hint={`${rows?.length ?? 0} ${t.exercises}`}
        />
      </div>

      <div className="mt-6">
        <p className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">
          {t.weeklyActivity}
        </p>
        {isEmpty ? (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t.noConfidenceYet}
          </p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                  }}
                  formatter={(v: number, name: string) => [`${v} ${t.exercises}`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="breathing"
                  name={t.confidenceBreathing}
                  stackId="a"
                  fill="var(--theme-breathing)"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="articulation"
                  name={t.confidenceArticulation}
                  stackId="a"
                  fill="var(--theme-articulation)"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="guided"
                  name={t.confidenceGuided}
                  stackId="a"
                  fill="var(--theme-confidence)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border bg-background/50 p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 font-serif text-3xl text-foreground">{value}</div>
      {hint && <div className="mt-1 truncate text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
