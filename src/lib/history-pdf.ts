import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Session } from "./history-store";
import type { PronunciationSession } from "./pronunciation-history";

/** jspdf-autotable enrichit l'instance avec la position finale du dernier tableau. */
type AutoTableDoc = jsPDF & { lastAutoTable?: { finalY: number } };

export type HistoryBadge = {
  code: string;
  icon: string;
  title: string;
  desc: string;
  unlocked: boolean;
  unlockedAt?: string | null;
};

export type HistoryLesson = {
  title: string;
  completedAt: string;
};

export type HistoryReport = {
  lang: "fr" | "en";
  displayName?: string | null;
  stats: { streak: number; longest: number; lessons: number; views: number };
  speech: Session[];
  pron: PronunciationSession[];
  lessons: HistoryLesson[];
  badges: HistoryBadge[];
  include?: { summary?: boolean; timeline?: boolean; badges?: boolean };
  labels: {
    reportTitle: string;
    exportedOn: string;
    summary: string;
    streak: string;
    longestStreak: string;
    lessonsCompleted: string;
    contentsViewed: string;
    timeline: string;
    badges: string;
    unlocked: string;
    locked: string;
    speaking: string;
    pronunciation: string;
    lesson: string;
    date: string;
    type: string;
    detail: string;
    metric: string;
    generatedBy: string;
    none: string;
  };
};

function fmtDate(t: number | string, lang: string) {
  const d = typeof t === "number" ? new Date(t) : new Date(t);
  return d.toLocaleString(lang, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildHistoryPdf(r: HistoryReport) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  const L = r.labels;
  const inc = {
    summary: r.include?.summary !== false,
    timeline: r.include?.timeline !== false,
    badges: r.include?.badges !== false,
  };
  const cursorY = 140;
  let firstSection = true;
  const nextStartY = () => {
    if (firstSection) {
      firstSection = false;
      return cursorY;
    }
    const last = (doc as AutoTableDoc).lastAutoTable;
    return last?.finalY ? last.finalY + 24 : cursorY;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 30, 30);
  doc.text("ALESIM", M, 60);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`${L.exportedOn} ${new Date().toLocaleString(r.lang)}`, W - M, 60, {
    align: "right",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(30, 30, 30);
  doc.text(L.reportTitle, M, 100);

  if (r.displayName) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(90, 90, 90);
    doc.text(r.displayName, M, 120);
  }

  // Summary
  if (inc.summary) {
    autoTable(doc, {
      startY: nextStartY(),
      head: [[L.summary, ""]],
      body: [
        [L.streak, String(r.stats.streak)],
        [L.longestStreak, String(r.stats.longest)],
        [L.lessonsCompleted, String(r.stats.lessons)],
        [L.contentsViewed, String(r.stats.views)],
      ],
      styles: { font: "helvetica", fontSize: 11, cellPadding: 8 },
      headStyles: { fillColor: [140, 158, 130], textColor: 255 },
      margin: { left: M, right: M },
    });
  }

  // Timeline
  const rows: RowInput[] = [];
  for (const s of r.speech) {
    rows.push([
      fmtDate(s.createdAt, r.lang),
      L.speaking,
      (s.transcript || s.prompt || "").slice(0, 90),
      `clarity ${s.feedback.clarity} · confidence ${s.feedback.confidence}`,
    ]);
  }
  for (const s of r.pron) {
    rows.push([
      fmtDate(s.createdAt, r.lang),
      `${L.pronunciation} · ${s.lang.toUpperCase()}`,
      s.reference.slice(0, 90),
      `acc ${s.accuracy} · flu ${s.fluency}`,
    ]);
  }
  for (const l of r.lessons) {
    rows.push([fmtDate(l.completedAt, r.lang), L.lesson, l.title.slice(0, 90), "—"]);
  }
  rows.sort((a, b) => (String(b[0]) > String(a[0]) ? 1 : -1));

  if (inc.timeline) {
    autoTable(doc, {
      head: [[L.date, L.type, L.detail, L.metric]],
      body: rows.length ? rows : [[L.none, "", "", ""]],
      styles: { font: "helvetica", fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [140, 158, 130], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 110 },
        1: { cellWidth: 90 },
        2: { cellWidth: "auto" },
        3: { cellWidth: 110 },
      },
      margin: { left: M, right: M },
      didDrawPage: () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(30, 30, 30);
        doc.text(L.timeline, M, 40);
      },
      startY: inc.summary ? nextStartY() : 100,
    });
  }

  // Badges page
  if (inc.badges) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 30, 30);
    doc.text(L.badges, M, 60);

    autoTable(doc, {
      startY: 80,
      head: [["", "Badge", "", ""]],
      body: r.badges.map((b) => [
        b.icon,
        b.title,
        b.desc,
        b.unlocked
          ? `${L.unlocked}${b.unlockedAt ? ` — ${fmtDate(b.unlockedAt, r.lang)}` : ""}`
          : L.locked,
      ]),
      styles: { font: "helvetica", fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [140, 158, 130], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 34, halign: "center" },
        1: { cellWidth: 130, fontStyle: "bold" },
        2: { cellWidth: "auto" },
        3: { cellWidth: 130 },
      },
      margin: { left: M, right: M },
    });
  }

  // Footer on last page
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text(L.generatedBy, M, doc.internal.pageSize.getHeight() - 24);

  return doc;
}

type RowInput = Array<string | number>;
