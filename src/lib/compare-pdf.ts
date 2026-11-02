import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** jspdf-autotable enrichit l'instance avec la position finale du dernier tableau. */
type AutoTableDoc = jsPDF & { lastAutoTable?: { finalY: number } };

type Stats = {
  count: number;
  accuracy: number;
  fluency: number;
  confidence: number;
  fillerTotal: number;
  pauseTotal: number;
  pauseSecTotal: number;
  fillerPerMin: number;
  pausePerMin: number;
  pauseSecPerMin: number;
  durationTotal: number;
};

export type CompareReport = {
  lang: "fr" | "en";
  periodLabel: string;
  a: { name: string; flag: string; stats: Stats };
  b: { name: string; flag: string; stats: Stats };
  labels: {
    reportTitle: string;
    exportedOn: string;
    period: string;
    summary: string;
    metric: string;
    accuracy: string;
    fluency: string;
    confidence: string;
    sessions: string;
    hesitations: string;
    fillerWords: string;
    pauses: string;
    pauseTime: string;
    perMinute: string;
    total: string;
    seconds: string;
    generatedBy: string;
  };
};

export function buildComparePdf(r: CompareReport) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  const L = r.labels;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 30, 30);
  doc.text("ALESIM", M, 60);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  const dateStr = new Date().toLocaleString(r.lang);
  doc.text(`${L.exportedOn} ${dateStr}`, W - M, 60, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(30, 30, 30);
  doc.text(L.reportTitle, M, 100);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90, 90, 90);
  doc.text(`${L.period}: ${r.periodLabel}`, M, 120);
  doc.text(`${r.a.name}  vs  ${r.b.name}`, M, 138);

  // Summary table (skills)
  autoTable(doc, {
    startY: 160,
    head: [[L.metric, r.a.name, r.b.name]],
    body: [
      [L.sessions, String(r.a.stats.count), String(r.b.stats.count)],
      [L.accuracy, `${r.a.stats.accuracy}%`, `${r.b.stats.accuracy}%`],
      [L.fluency, `${r.a.stats.fluency}%`, `${r.b.stats.fluency}%`],
      [L.confidence, `${r.a.stats.confidence}%`, `${r.b.stats.confidence}%`],
    ],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 11, cellPadding: 8 },
    headStyles: { fillColor: [232, 106, 79], textColor: 255 },
    margin: { left: M, right: M },
  });

  const afterSkills = (doc as AutoTableDoc).lastAutoTable!.finalY + 24;

  // Hesitations table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(L.hesitations, M, afterSkills);

  autoTable(doc, {
    startY: afterSkills + 12,
    head: [
      [
        L.metric,
        `${r.a.name} — ${L.total}`,
        `${r.a.name} — ${L.perMinute}`,
        `${r.b.name} — ${L.total}`,
        `${r.b.name} — ${L.perMinute}`,
      ],
    ],
    body: [
      [
        L.fillerWords,
        String(r.a.stats.fillerTotal),
        String(r.a.stats.fillerPerMin),
        String(r.b.stats.fillerTotal),
        String(r.b.stats.fillerPerMin),
      ],
      [
        L.pauses,
        String(r.a.stats.pauseTotal),
        String(r.a.stats.pausePerMin),
        String(r.b.stats.pauseTotal),
        String(r.b.stats.pausePerMin),
      ],
      [
        L.pauseTime,
        `${r.a.stats.pauseSecTotal}${L.seconds}`,
        `${r.a.stats.pauseSecPerMin}${L.seconds}`,
        `${r.b.stats.pauseSecTotal}${L.seconds}`,
        `${r.b.stats.pauseSecPerMin}${L.seconds}`,
      ],
    ],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 10, cellPadding: 7 },
    headStyles: { fillColor: [45, 90, 95], textColor: 255 },
    margin: { left: M, right: M },
  });

  const afterHes = (doc as AutoTableDoc).lastAutoTable!.finalY + 24;

  // Summary paragraph
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(L.summary, M, afterHes);

  const leader = (x: number, y: number) => (x === y ? null : x > y ? "A" : "B");
  const accLead = leader(r.a.stats.accuracy, r.b.stats.accuracy);
  const fluLead = leader(r.a.stats.fluency, r.b.stats.fluency);
  const confLead = leader(r.a.stats.confidence, r.b.stats.confidence);
  const nameOf = (side: "A" | "B" | null) =>
    side === "A" ? r.a.name : side === "B" ? r.b.name : "—";

  const lines = [
    `• ${L.accuracy}: ${nameOf(accLead)}`,
    `• ${L.fluency}: ${nameOf(fluLead)}`,
    `• ${L.confidence}: ${nameOf(confLead)}`,
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  lines.forEach((line, i) => doc.text(line, M, afterHes + 22 + i * 18));

  // Footer
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(L.generatedBy, M, pageH - 24);

  return doc;
}
