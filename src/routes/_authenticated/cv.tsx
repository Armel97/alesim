import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  FileText,
  Upload,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Sparkles,
  ShieldCheck,
  Target,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AuthedNav } from "@/components/AuthedNav";
import { useLang } from "@/lib/i18n";
import { toast } from "sonner";
import {
  analyzeCv,
  deleteCvAnalysis,
  getCvAnalysis,
  listMyCvAnalyses,
  regenerateAxis,
  type CvAnalysis,
  type CvAxis,
} from "@/lib/cv.functions";
import { extractCvText, type ExtractKind } from "@/lib/cv-extract";

export const Route = createFileRoute("/_authenticated/cv")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Analyse de CV — ALESIM" },
      {
        name: "description",
        content:
          "Fais évaluer ton CV par ALESIM : axes d'amélioration priorisés et corrections concrètes prêtes à copier.",
      },
      { property: "og:title", content: "ALESIM — Analyse de CV" },
      {
        property: "og:description",
        content:
          "Import PDF, DOCX ou photo. L'IA identifie axes à travailler et propose des reformulations.",
      },
    ],
  }),
  component: CvPage,
});

type StoredAnalysis = CvAnalysis & { id: string; created_at: string };
type HistoryItem = {
  id: string;
  file_name: string;
  file_kind: string;
  target_role: string | null;
  score: number;
  summary: string;
  created_at: string;
};

const IMPACT_LABEL: Record<CvAxis["impact"], { fr: string; en: string; tone: string }> = {
  fort: { fr: "Impact fort", en: "High impact", tone: "bg-primary/15 text-primary" },
  moyen: {
    fr: "Impact moyen",
    en: "Medium impact",
    tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  faible: { fr: "Impact modéré", en: "Low impact", tone: "bg-muted text-muted-foreground" },
};

const LESSON_LINKS: Record<string, { fr: string; en: string }> = {
  confiance: { fr: "Renforcer la confiance", en: "Build confidence" },
  articulation: { fr: "Travailler l'articulation", en: "Practice articulation" },
  débit: { fr: "Réguler le débit", en: "Regulate pace" },
  structure: { fr: "Structurer sa parole", en: "Structure your speech" },
};

function CvPage() {
  const { lang } = useLang();
  const isFr = lang === "fr";
  const analyze = useServerFn(analyzeCv);
  const regen = useServerFn(regenerateAxis);
  const listHist = useServerFn(listMyCvAnalyses);
  const fetchOne = useServerFn(getCvAnalysis);
  const remove = useServerFn(deleteCvAnalysis);

  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<ExtractKind | null>(null);
  const [extracted, setExtracted] = useState<string>("");
  const [extracting, setExtracting] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [targetRole, setTargetRole] = useState("");
  const [analysis, setAnalysis] = useState<StoredAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [regenIdx, setRegenIdx] = useState<number | null>(null);
  const [openIdx, setOpenIdx] = useState<Set<number>>(new Set([0]));
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    listHist({})
      .then((rows) => setHistory(rows as HistoryItem[]))
      .catch(() => setHistory([]));
  }, [listHist]);

  async function onFileChange(f: File | null) {
    setAnalysis(null);
    setExtracted("");
    setOcrProgress(0);
    setFile(f);
    if (!f) {
      setKind(null);
      return;
    }
    if (f.size > 12 * 1024 * 1024) {
      toast.error(isFr ? "Fichier trop volumineux (max 12 Mo)." : "File too large (max 12 MB).");
      setFile(null);
      return;
    }
    setExtracting(true);
    try {
      const { kind: k, text } = await extractCvText(f, lang, (p) => setOcrProgress(p));
      setKind(k);
      setExtracted(text);
      if (text.length < 80) {
        toast.warning(
          isFr
            ? "Peu de texte détecté. Vérifie la qualité du fichier."
            : "Little text detected. Check the file quality.",
        );
      }
    } catch (e) {
      console.error(e);
      toast.error(isFr ? "Impossible de lire ce fichier." : "Could not read this file.");
      setFile(null);
      setKind(null);
    } finally {
      setExtracting(false);
    }
  }

  async function launchAnalysis() {
    if (!file || !kind || extracted.length < 50) return;
    setAnalyzing(true);
    try {
      const res = await analyze({
        data: {
          extractedText: extracted,
          fileName: file.name,
          fileKind: kind,
          targetRole: targetRole.trim() || undefined,
          lang,
        },
      });
      setAnalysis(res as StoredAnalysis);
      setOpenIdx(new Set([0]));
      const rows = await listHist({});
      setHistory(rows as HistoryItem[]);
      toast.success(isFr ? "Analyse prête." : "Analysis ready.");
    } catch (e) {
      console.error(e);
      toast.error(isFr ? "L'analyse a échoué. Réessaie." : "Analysis failed. Try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function copyCorrection(idx: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((v) => (v === idx ? null : v)), 1600);
    } catch {
      toast.error(isFr ? "Copie impossible." : "Copy failed.");
    }
  }

  async function onRegen(idx: number) {
    if (!analysis) return;
    setRegenIdx(idx);
    try {
      const { axis } = await regen({ data: { analysisId: analysis.id, axisIndex: idx } });
      setAnalysis((a) => {
        if (!a) return a;
        const axes = [...a.axes];
        axes[idx] = axis;
        return { ...a, axes };
      });
    } catch {
      toast.error(isFr ? "Nouvelle proposition impossible." : "Regeneration failed.");
    } finally {
      setRegenIdx(null);
    }
  }

  async function loadHistoryItem(id: string) {
    try {
      const row = (await fetchOne({ data: { id } })) as {
        id: string;
        created_at: string;
        score: number;
        summary: string;
        tone_note: string;
        axes?: unknown;
        keywords?: unknown;
        suggested_lesson_theme: string | null;
        target_role?: string | null;
      };
      setAnalysis({
        id: row.id,
        created_at: row.created_at,
        score: row.score,
        summary: row.summary,
        tone_note: row.tone_note,
        axes: (row.axes ?? []) as CvAxis[],
        keywords: (row.keywords ?? []) as string[],
        suggested_lesson_theme: row.suggested_lesson_theme,
      });
      setTargetRole(row.target_role ?? "");
      setFile(null);
      setExtracted("");
      setKind(null);
      setOpenIdx(new Set([0]));
    } catch {
      toast.error(isFr ? "Impossible d'ouvrir cette analyse." : "Cannot open this analysis.");
    }
  }

  async function deleteHistoryItem(id: string) {
    if (!confirm(isFr ? "Supprimer cette analyse ?" : "Delete this analysis?")) return;
    try {
      await remove({ data: { id } });
      setHistory((h) => h.filter((x) => x.id !== id));
      if (analysis?.id === id) setAnalysis(null);
    } catch {
      toast.error(isFr ? "Suppression impossible." : "Delete failed.");
    }
  }

  function toggleAxis(i: number) {
    setOpenIdx((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }

  return (
    <div className="min-h-svh bg-background">
      <AuthedNav />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 pb-16">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-primary">
            <FileText className="h-5 w-5" />
            <span className="font-medium">{isFr ? "Analyse de CV" : "Résumé review"}</span>
          </div>
          <h1 className="font-serif text-3xl">
            {isFr ? "Ton CV, relu avec bienveillance." : "Your résumé, reviewed with care."}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isFr
              ? "Importe ton CV pour recevoir des axes d'amélioration priorisés et des reformulations prêtes à copier. Analyse indicative — pas un jugement définitif."
              : "Upload your résumé for prioritized improvement areas and ready-to-paste rewrites. Advisory, not a verdict."}
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            {isFr
              ? "Extraction et OCR effectués sur ton appareil. Seul le texte est envoyé à l'IA."
              : "Extraction and OCR run on your device. Only text is sent to the AI."}
          </p>
        </header>

        {/* Upload */}
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <label className="block text-sm font-medium">
            {isFr ? "Importer un CV" : "Upload a résumé"}
          </label>
          <div className="mt-3 flex flex-col gap-3">
            <div
              onClick={() => inputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted/40"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
            >
              <Upload className="h-6 w-6" />
              <span>
                {file
                  ? `${file.name} — ${(file.size / 1024).toFixed(0)} Ko`
                  : isFr
                    ? "PDF, DOCX ou image (max 12 Mo)"
                    : "PDF, DOCX or image (max 12 MB)"}
              </span>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,image/*"
              className="hidden"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />

            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value.slice(0, 200))}
                placeholder={
                  isFr
                    ? "Poste visé (optionnel) — ex. Chef de projet"
                    : "Target role (optional) — e.g. Product manager"
                }
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {extracting && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {kind === "image"
                  ? (isFr ? "OCR en cours" : "OCR in progress") +
                    (ocrProgress > 0 ? ` — ${Math.round(ocrProgress * 100)}%` : "…")
                  : isFr
                    ? "Extraction du texte…"
                    : "Extracting text…"}
              </div>
            )}

            {extracted && !extracting && (
              <details className="rounded-lg border bg-background/50 p-3 text-sm">
                <summary className="cursor-pointer select-none font-medium">
                  {isFr ? "Aperçu du texte extrait" : "Extracted text preview"} ({extracted.length}{" "}
                  {isFr ? "caractères" : "chars"})
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-sans text-xs text-muted-foreground">
                  {extracted.slice(0, 4000)}
                  {extracted.length > 4000 ? "\n…" : ""}
                </pre>
              </details>
            )}

            <button
              disabled={!extracted || extracting || analyzing || extracted.length < 50}
              onClick={launchAnalysis}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isFr ? "Analyse de ton CV en cours…" : "Analyzing your résumé…"}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {isFr ? "Analyser mon CV" : "Analyze my résumé"}
                </>
              )}
            </button>
          </div>
        </section>

        {/* Result */}
        {analysis && (
          <section className="flex flex-col gap-4">
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {isFr ? "Score indicatif" : "Advisory score"}
                  </p>
                  <p className="mt-1 font-serif text-4xl">
                    {analysis.score}
                    <span className="text-lg text-muted-foreground">/100</span>
                  </p>
                </div>
                <div className="w-1/2">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.max(4, Math.min(100, analysis.score))}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {isFr
                      ? "Cet indicateur t'aide à visualiser ta marge de progression."
                      : "This gauge helps you visualize room to grow."}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm">{analysis.summary}</p>
              {analysis.tone_note && (
                <p className="mt-2 rounded-lg bg-muted/50 p-3 text-sm">
                  <span className="font-medium">{isFr ? "Ton perçu : " : "Tone : "}</span>
                  {analysis.tone_note}
                </p>
              )}
              {analysis.suggested_lesson_theme && LESSON_LINKS[analysis.suggested_lesson_theme] && (
                <p className="mt-3 text-xs text-primary">
                  {isFr ? "Leçon suggérée : " : "Suggested lesson: "}
                  <span className="font-medium">
                    {LESSON_LINKS[analysis.suggested_lesson_theme][isFr ? "fr" : "en"]}
                  </span>
                </p>
              )}
            </div>

            {/* Axes */}
            <div className="flex flex-col gap-3">
              <h2 className="font-serif text-xl">
                {isFr ? "Axes d'amélioration" : "Improvement areas"}
              </h2>
              {analysis.axes.map((axis, i) => {
                const impact = IMPACT_LABEL[axis.impact];
                const open = openIdx.has(i);
                return (
                  <article key={i} className="rounded-2xl border bg-card shadow-sm">
                    <button
                      onClick={() => toggleAxis(i)}
                      className="flex w-full items-center justify-between gap-3 p-4 text-left"
                    >
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${impact.tone}`}
                        >
                          {impact[isFr ? "fr" : "en"]}
                        </span>
                        <span className="font-medium">{axis.title}</span>
                      </div>
                      {open ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    {open && (
                      <div className="border-t p-4 text-sm">
                        <p className="mb-3">{axis.problem}</p>
                        <div className="mb-3 rounded-lg bg-muted/50 p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            {isFr ? "Extrait de ton CV" : "From your résumé"}
                          </p>
                          <p className="mt-1 italic">« {axis.example} »</p>
                        </div>
                        <div className="rounded-lg bg-primary/5 p-3">
                          <p className="text-xs uppercase tracking-wide text-primary">
                            {isFr ? "Proposition corrigée" : "Suggested rewrite"}
                          </p>
                          <p className="mt-1">{axis.correction}</p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => copyCorrection(i, axis.correction)}
                            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs hover:bg-muted"
                          >
                            {copiedIdx === i ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                            {copiedIdx === i
                              ? isFr
                                ? "Copié"
                                : "Copied"
                              : isFr
                                ? "Copier la version corrigée"
                                : "Copy the rewrite"}
                          </button>
                          <button
                            disabled={regenIdx === i}
                            onClick={() => onRegen(i)}
                            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                          >
                            {regenIdx === i ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                            {isFr
                              ? "Régénérer une autre proposition"
                              : "Regenerate another version"}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            {analysis.keywords.length > 0 && (
              <div className="rounded-2xl border bg-card p-5 shadow-sm">
                <h3 className="font-serif text-lg">
                  {isFr ? "Mots-clés à intégrer" : "Keywords to weave in"}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isFr
                    ? "Ces termes ressortent souvent pour le poste visé — glisse-les naturellement dans tes expériences."
                    : "These terms often stand out for the target role — weave them naturally into your experiences."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {analysis.keywords.map((kw) => (
                    <span key={kw} className="rounded-full bg-secondary px-3 py-1 text-xs">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* History */}
        {history.length > 0 && (
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-serif text-lg">
              {isFr ? "Analyses précédentes" : "Previous analyses"}
            </h2>
            <ul className="mt-3 flex flex-col divide-y">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-3">
                  <button
                    onClick={() => loadHistoryItem(h.id)}
                    className="flex flex-1 flex-col items-start gap-0.5 text-left"
                  >
                    <span className="text-sm font-medium">{h.file_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString(isFr ? "fr-FR" : "en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {h.target_role ? ` · ${h.target_role}` : ""} · {isFr ? "score" : "score"}{" "}
                      {h.score}/100
                    </span>
                  </button>
                  <button
                    onClick={() => deleteHistoryItem(h.id)}
                    className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={isFr ? "Supprimer" : "Delete"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
