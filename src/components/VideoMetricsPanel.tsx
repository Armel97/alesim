import { Eye, Move3d, PersonStanding, Smile, Hand } from "lucide-react";

export type VideoMetricValues = {
  gazeCameraPct?: number | undefined;
  postureScore?: number | undefined;
  stabilityScore?: number | undefined;
  expressivity?: number | undefined;
  handsUsagePct?: number | undefined;
};

type Tone = "good" | "ok" | "low";

function tone(v: number, good: number, ok: number): Tone {
  if (v >= good) return "good";
  if (v >= ok) return "ok";
  return "low";
}

const RING: Record<Tone, string> = {
  good: "text-primary",
  ok: "text-accent-foreground",
  low: "text-muted-foreground",
};

const BADGE: Record<Tone, string> = {
  good: "bg-primary/15 text-primary",
  ok: "bg-secondary text-secondary-foreground",
  low: "bg-muted text-muted-foreground",
};

function Gauge({
  label,
  value,
  suffix,
  icon,
  hint,
  t,
}: {
  label: string;
  value: number;
  suffix: string;
  icon: React.ReactNode;
  hint: string;
  t: Tone;
}) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col items-center rounded-3xl border bg-background p-4 text-center">
      <div className="relative h-24 w-24">
        <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
          <circle cx="40" cy="40" r={r} className="stroke-border" strokeWidth="7" fill="none" />
          <circle
            cx="40"
            cy="40"
            r={r}
            className={`${RING[t]} transition-[stroke-dashoffset] duration-700`}
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={c - (c * pct) / 100}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-2xl leading-none">{Math.round(pct)}</span>
          <span className="text-[10px] text-muted-foreground">{suffix}</span>
        </div>
      </div>
      <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Bar({ label, value, unit }: { label: string; value: number; unit: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {Math.round(pct)}
          {unit}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Visual read-out of the on-device video metrics (gaze, posture, framing
 * stability). Values are aggregates computed locally — no video is stored.
 */
export function VideoMetricsPanel({
  fr,
  metrics,
  compact,
}: {
  fr: boolean;
  metrics: VideoMetricValues;
  compact?: boolean;
}) {
  const gaze = metrics.gazeCameraPct ?? 0;
  const posture = metrics.postureScore ?? 0;
  const stability = metrics.stabilityScore ?? 0;
  const hasSecondary =
    metrics.expressivity !== undefined || metrics.handsUsagePct !== undefined;

  const tg = tone(gaze, 65, 40);
  const tp = tone(posture, 70, 45);
  const ts = tone(stability, 70, 45);

  const advice =
    tg === "low"
      ? fr
        ? "Essaie de revenir vers l'objectif après chaque idée : le recruteur perçoit ça comme de l'assurance."
        : "Try coming back to the lens after each idea — recruiters read that as confidence."
      : ts === "low"
        ? fr
          ? "Ton cadrage bouge beaucoup. Pose les avant-bras et respire : ça stabilise l'image et la voix."
          : "Your framing moves a lot. Rest your forearms and breathe — it steadies both image and voice."
        : tp === "low"
          ? fr
            ? "Redresse légèrement les épaules et éloigne-toi de 10 cm de l'écran : la posture s'ouvre tout de suite."
            : "Roll your shoulders back and sit 10 cm further from the screen — your posture opens up instantly."
          : fr
            ? "Belle présence : regard posé, posture ouverte et cadrage calme. Garde ce rythme."
            : "Lovely presence: steady gaze, open posture, calm framing. Keep that rhythm.";

  return (
    <section className="rounded-3xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {fr ? "Présence à l'image" : "On-camera presence"}
        </p>
        <span className={`rounded-full px-2.5 py-1 text-xs ${BADGE[tone((gaze + posture + stability) / 3, 70, 45)]}`}>
          {fr ? "Analyse locale, aucune vidéo enregistrée" : "On-device analysis, no video stored"}
        </span>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3"}`}>
        <Gauge
          label={fr ? "Regard caméra" : "Eye contact"}
          value={gaze}
          suffix="%"
          t={tg}
          icon={<Eye className="h-4 w-4" />}
          hint={fr ? "Temps face à l'objectif" : "Time facing the lens"}
        />
        <Gauge
          label={fr ? "Posture" : "Posture"}
          value={posture}
          suffix="/100"
          t={tp}
          icon={<PersonStanding className="h-4 w-4" />}
          hint={fr ? "Épaules ouvertes et alignées" : "Open, level shoulders"}
        />
        <Gauge
          label={fr ? "Stabilité" : "Stability"}
          value={stability}
          suffix="/100"
          t={ts}
          icon={<Move3d className="h-4 w-4" />}
          hint={fr ? "Calme du cadrage" : "Calm framing"}
        />
      </div>

      {hasSecondary && !compact && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {metrics.expressivity !== undefined && (
            <Bar
              label={fr ? "Expressivité" : "Expressivity"}
              value={metrics.expressivity}
              unit="/100"
            />
          )}
          {metrics.handsUsagePct !== undefined && (
            <Bar
              label={fr ? "Gestuelle visible" : "Visible gestures"}
              value={metrics.handsUsagePct}
              unit="%"
            />
          )}
        </div>
      )}

      <p className="mt-4 rounded-2xl bg-background/70 p-3 text-sm">{advice}</p>
    </section>
  );
}

export function VideoMetricChips({ fr, metrics }: { fr: boolean; metrics: VideoMetricValues }) {
  const items: { icon: React.ReactNode; label: string; value: string }[] = [];
  if (metrics.gazeCameraPct !== undefined)
    items.push({
      icon: <Eye className="h-3 w-3" />,
      label: fr ? "Regard" : "Gaze",
      value: `${Math.round(metrics.gazeCameraPct)}%`,
    });
  if (metrics.postureScore !== undefined)
    items.push({
      icon: <PersonStanding className="h-3 w-3" />,
      label: fr ? "Posture" : "Posture",
      value: `${Math.round(metrics.postureScore)}`,
    });
  if (metrics.stabilityScore !== undefined)
    items.push({
      icon: <Move3d className="h-3 w-3" />,
      label: fr ? "Stabilité" : "Stability",
      value: `${Math.round(metrics.stabilityScore)}`,
    });
  if (metrics.expressivity !== undefined)
    items.push({
      icon: <Smile className="h-3 w-3" />,
      label: fr ? "Expressivité" : "Expressivity",
      value: `${Math.round(metrics.expressivity)}`,
    });
  if (metrics.handsUsagePct !== undefined)
    items.push({
      icon: <Hand className="h-3 w-3" />,
      label: fr ? "Gestes" : "Gestures",
      value: `${Math.round(metrics.handsUsagePct)}%`,
    });
  if (!items.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((it) => (
        <span
          key={it.label}
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
        >
          {it.icon}
          {it.label} {it.value}
        </span>
      ))}
    </div>
  );
}
