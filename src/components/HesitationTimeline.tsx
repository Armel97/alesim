import { useMemo, useState } from "react";
import type { TimelineEvent } from "@/lib/hesitations";

type Props = {
  events: TimelineEvent[];
  durationSec: number;
  color: string; // tailwind class e.g. "bg-accent"
  filter?: "all" | "speech" | "pause" | "filler";
  labels: {
    filler: string;
    pause: string;
    speech: string;
    zoom: string;
    reset: string;
    seconds: string;
    segment: string;
    empty: string;
  };
};

const SEGMENTS = 4;

export function HesitationTimeline({ events, durationSec, color, filter = "all", labels }: Props) {
  const [segment, setSegment] = useState<number | null>(null);

  const total = Math.max(durationSec, 0.001);
  const range = useMemo(() => {
    if (segment === null) return { start: 0, end: total };
    const size = total / SEGMENTS;
    return { start: segment * size, end: (segment + 1) * size };
  }, [segment, total]);

  if (!events.length) {
    return <p className="text-sm text-muted-foreground">{labels.empty}</p>;
  }

  const span = Math.max(range.end - range.start, 0.001);
  const visible = events.filter(
    (e) => e.end > range.start && e.start < range.end && (filter === "all" || e.type === filter),
  );

  const fmt = (s: number) => `${s.toFixed(1)}${labels.seconds}`;

  return (
    <div className="space-y-3">
      {/* Zoom selector */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {labels.zoom}
        </span>
        <button
          type="button"
          onClick={() => setSegment(null)}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
            segment === null
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          {labels.reset}
        </button>
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSegment(i)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              segment === i
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {labels.segment} {i + 1}
          </button>
        ))}
      </div>

      {/* Bar */}
      <div className="relative h-14 w-full overflow-hidden rounded-2xl border bg-secondary/40">
        {/* Speech baseline */}
        <div className={`absolute inset-y-4 left-0 right-0 rounded-full ${color} opacity-20`} />
        {visible.map((e, i) => {
          const from = Math.max(e.start, range.start);
          const to = Math.min(e.end, range.end);
          const left = ((from - range.start) / span) * 100;
          const width = Math.max(((to - from) / span) * 100, 0.4);
          if (e.type === "speech") {
            return (
              <div
                key={i}
                title={`${e.label ?? ""} · ${fmt(e.start)}`}
                className={`absolute top-4 h-6 rounded-md ${color} opacity-70`}
                style={{ left: `${left}%`, width: `${width}%` }}
              />
            );
          }
          if (e.type === "pause") {
            return (
              <div
                key={i}
                title={`${labels.pause} · ${fmt(e.end - e.start)}`}
                className="absolute top-4 h-6 rounded-md bg-muted-foreground/25"
                style={{ left: `${left}%`, width: `${width}%` }}
              />
            );
          }
          // filler event marker
          return (
            <div
              key={i}
              title={`${labels.filler}: ${e.label ?? ""} · ${fmt(e.start)}`}
              className="absolute top-1 flex flex-col items-center"
              style={{ left: `calc(${left}% - 4px)` }}
            >
              <span className="h-3 w-3 rotate-45 rounded-sm bg-destructive shadow-sm" />
              <span className="mt-0.5 h-9 w-[2px] bg-destructive/60" />
            </div>
          );
        })}

        {/* Time axis */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-2 pb-1 text-[9px] text-muted-foreground">
          <span>{fmt(range.start)}</span>
          <span>{fmt((range.start + range.end) / 2)}</span>
          <span>{fmt(range.end)}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-2 w-4 rounded-sm ${color} opacity-70`} />
          {labels.speech}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm bg-muted-foreground/40" />
          {labels.pause}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rotate-45 bg-destructive" />
          {labels.filler}
        </span>
      </div>
    </div>
  );
}
