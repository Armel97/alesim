import { useEffect, useMemo, useState } from "react";
import { X, Download, Loader2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { buildHistoryPdf, type HistoryReport } from "@/lib/history-pdf";
import { buildFullCsv, buildTimelineCsv, downloadCsv } from "@/lib/history-csv";

type Props = {
  open: boolean;
  onClose: () => void;
  buildReport: (include: {
    summary: boolean;
    timeline: boolean;
    badges: boolean;
  }) => Promise<HistoryReport>;
};

export function ExportHistoryDialog({ open, onClose, buildReport }: Props) {
  const { t } = useLang();
  const [include, setInclude] = useState({ summary: true, timeline: true, badges: true });
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportCache, setReportCache] = useState<HistoryReport | null>(null);
  const [fileDate, setFileDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [fileName, setFileName] = useState<string>("alesim-history");

  const sanitize = (s: string) =>
    s
      .trim()
      .replace(/[^\w-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "alesim-history";
  const baseName = `${sanitize(fileName)}-${fileDate || new Date().toISOString().slice(0, 10)}`;

  useEffect(() => {
    if (!open) return;
    let revoked = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const report = await buildReport(include);
        if (revoked) return;
        setReportCache(report);
        const doc = buildHistoryPdf(report);
        const url = doc.output("bloburl") as unknown as string;
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!revoked) setLoading(false);
      }
    })();
    return () => {
      revoked = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, include.summary, include.timeline, include.badges]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canGenerate = useMemo(
    () => include.summary || include.timeline || include.badges,
    [include],
  );

  if (!open) return null;

  function handleDownload() {
    if (!reportCache) return;
    const doc = buildHistoryPdf(reportCache);
    doc.save(`${baseName}.pdf`);
  }

  function handleDownloadCsv() {
    if (!reportCache) return;
    const csv = buildFullCsv(reportCache, include);
    downloadCsv(`${baseName}.csv`, csv);
  }

  function handleDownloadTimelineCsv() {
    if (!reportCache) return;
    const csv = buildTimelineCsv(reportCache);
    downloadCsv(`${baseName}-timeline.csv`, csv);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="flex h-full max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b p-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{t.exportPdf}</p>
            <h2 className="mt-1 font-serif text-2xl">{t.historyReportTitle}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-[260px_1fr]">
          <aside className="space-y-3 border-b p-5 md:border-b-0 md:border-r">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t.filterOnly}
            </p>
            <SectionToggle
              label={t.summary}
              checked={include.summary}
              onChange={(v) => setInclude((p) => ({ ...p, summary: v }))}
            />
            <SectionToggle
              label={t.activity}
              checked={include.timeline}
              onChange={(v) => setInclude((p) => ({ ...p, timeline: v }))}
            />
            <SectionToggle
              label={t.myBadges}
              checked={include.badges}
              onChange={(v) => setInclude((p) => ({ ...p, badges: v }))}
            />

            <div className="space-y-2 pt-2">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t.exportFileName}
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="alesim-history"
                className="w-full rounded-2xl border bg-background/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t.exportFileDate}
              </label>
              <input
                type="date"
                value={fileDate}
                onChange={(e) => setFileDate(e.target.value)}
                className="w-full rounded-2xl border bg-background/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="truncate text-[11px] text-muted-foreground" title={baseName}>
                {baseName}.pdf
              </p>
            </div>
          </aside>

          <div className="relative flex-1 bg-secondary/40">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            {error ? (
              <div className="p-6 text-sm text-destructive">{error}</div>
            ) : previewUrl ? (
              <iframe title="pdf-preview" src={previewUrl} className="h-full w-full" />
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {t.cancel ?? "Fermer"}
          </button>
          <button
            type="button"
            onClick={handleDownloadTimelineCsv}
            disabled={loading || !reportCache}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
            title="Timeline CSV"
          >
            <Download className="h-4 w-4" />
            Timeline CSV
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={!canGenerate || loading || !reportCache}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {t.exportHistoryCsv}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!canGenerate || loading || !reportCache}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft transition-opacity disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {t.exportHistoryPdf}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border bg-background/60 px-3 py-2.5 text-sm">
      <span className="font-medium">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[hsl(var(--primary))]"
      />
    </label>
  );
}
