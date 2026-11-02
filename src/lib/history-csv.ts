import type { HistoryReport } from "./history-pdf";

function esc(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

function fmt(t: number | string, lang: string) {
  const d = typeof t === "number" ? new Date(t) : new Date(t);
  return d.toLocaleString(lang);
}

export function buildTimelineCsv(r: HistoryReport): string {
  const L = r.labels;
  const rows: Array<Array<string | number>> = [
    [L.date, L.type, L.detail, "language", "clarity", "confidence", "accuracy", "fluency"],
  ];
  for (const s of r.speech) {
    rows.push([
      fmt(s.createdAt, r.lang),
      L.speaking,
      s.transcript || s.prompt || "",
      "",
      s.feedback.clarity ?? "",
      s.feedback.confidence ?? "",
      "",
      "",
    ]);
  }
  for (const s of r.pron) {
    rows.push([
      fmt(s.createdAt, r.lang),
      L.pronunciation,
      s.reference,
      s.lang.toUpperCase(),
      "",
      "",
      s.accuracy ?? "",
      s.fluency ?? "",
    ]);
  }
  for (const l of r.lessons) {
    rows.push([fmt(l.completedAt, r.lang), L.lesson, l.title, "", "", "", "", ""]);
  }
  rows.sort((a, b) =>
    a === rows[0] ? -1 : b === rows[0] ? 1 : String(b[0]) > String(a[0]) ? 1 : -1,
  );
  return toCsv(rows);
}

export function buildBadgesCsv(r: HistoryReport): string {
  const L = r.labels;
  const rows: Array<Array<string | number>> = [
    ["code", "title", "description", "status", "unlockedAt"],
  ];
  for (const b of r.badges) {
    rows.push([
      b.code,
      b.title,
      b.desc,
      b.unlocked ? L.unlocked : L.locked,
      b.unlockedAt ? fmt(b.unlockedAt, r.lang) : "",
    ]);
  }
  return toCsv(rows);
}

export function buildSummaryCsv(r: HistoryReport): string {
  const L = r.labels;
  return toCsv([
    [L.metric, "value"],
    [L.streak, r.stats.streak],
    [L.longestStreak, r.stats.longest],
    [L.lessonsCompleted, r.stats.lessons],
    [L.contentsViewed, r.stats.views],
  ]);
}

export function buildFullCsv(
  r: HistoryReport,
  include: { summary: boolean; timeline: boolean; badges: boolean },
): string {
  const parts: string[] = [];
  if (include.summary) {
    parts.push(`# ${r.labels.summary}`);
    parts.push(buildSummaryCsv(r));
  }
  if (include.timeline) {
    parts.push(`\n# ${r.labels.timeline}`);
    parts.push(buildTimelineCsv(r));
  }
  if (include.badges) {
    parts.push(`\n# ${r.labels.badges}`);
    parts.push(buildBadgesCsv(r));
  }
  return parts.join("\n");
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
