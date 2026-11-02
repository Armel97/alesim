import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { aiApiKey, aiBaseUrl, aiChatModel, aiTranscribeModel } from "./ai-config.server";


const LANG_CODES = ["en", "es", "de", "it", "pt"] as const;

const TranscribeInput = z.object({
  audioBase64: z.string().min(1),
  mimeType: z.string().default("audio/wav"),
  lang: z.enum(LANG_CODES),
});

export type TranscribedWord = { word: string; start: number; end: number };

export const transcribeInLanguage = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => TranscribeInput.parse(v))
  .handler(async ({ data }) => {
    const key = aiApiKey();

    const bin = atob(data.audioBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: data.mimeType });

    const form = new FormData();
    form.append("file", blob, "recording.wav");
    // whisper-1 supports word-level timestamps via verbose_json
    form.append("model", aiTranscribeModel());
    form.append("language", data.lang);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");

    const res = await fetch(`${aiBaseUrl()}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Transcription failed: ${res.status} ${err}`);
    }
    const json = (await res.json()) as {
      text?: string;
      words?: { word: string; start: number; end: number }[];
      duration?: number;
    };
    const words: TranscribedWord[] = Array.isArray(json.words)
      ? json.words.map((w) => ({
          word: String(w.word ?? "").trim(),
          start: Number(w.start ?? 0),
          end: Number(w.end ?? 0),
        }))
      : [];
    return {
      text: json.text ?? "",
      words,
      duration: typeof json.duration === "number" ? json.duration : undefined,
    };
  });

const PronounceInput = z.object({
  reference: z.string().min(1),
  transcript: z.string().min(1),
  lang: z.enum(LANG_CODES),
  uiLang: z.enum(["fr", "en"]).default("fr"),
});

export type WordCheck = { word: string; ok: boolean; hint?: string };

export type PronunciationResult = {
  accuracy: number; // 0-100
  fluency: number; // 0-100
  passed: boolean;
  words: WordCheck[];
  advice: string[];
  phoneticTip: string;
  nativeProximity?: number; // 0-100 overall closeness to native
  grammarIssues?: { issue: string; correction: string }[];
  phonemeIssues?: { word: string; phoneme: string; tip: string }[];
  trainingPlan?: {
    title: string;
    why: string;
    howto: string;
    durationMin: number;
    focus: "phoneme" | "grammar" | "fluency" | "rhythm" | "vocab";
  }[];
};

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .trim();
}

function tokenize(s: string) {
  return normalize(s).split(/\s+/).filter(Boolean);
}

function levenshtein(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[m];
}

export const analyzePronunciation = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => PronounceInput.parse(v))
  .handler(async ({ data }): Promise<PronunciationResult> => {
    const key = aiApiKey();

    // Deterministic per-word check based on transcription
    const refTokens = tokenize(data.reference);
    const heardTokens = tokenize(data.transcript);
    const heardSet = new Set(heardTokens);

    const words: WordCheck[] = refTokens.map((w) => {
      if (heardSet.has(w)) return { word: w, ok: true };
      // fuzzy: any heard token within edit distance 1 (or <=20% of length)
      const tol = Math.max(1, Math.floor(w.length * 0.2));
      const close = heardTokens.some((h) => levenshtein(w, h) <= tol);
      return { word: w, ok: close };
    });

    const okCount = words.filter((w) => w.ok).length;
    const accuracy = Math.round((okCount / Math.max(1, words.length)) * 100);

    // Ask the model for phonetic advice on the mispronounced words + fluency estimate
    const wrong = words.filter((w) => !w.ok).map((w) => w.word);
    const sys =
      data.uiLang === "fr"
        ? "Tu es un coach de prononciation multilingue. Réponds STRICTEMENT en JSON valide, sans markdown."
        : "You are a multilingual pronunciation coach. Reply STRICTLY as valid JSON, no markdown.";
    const user = `Langue cible: ${data.lang}
Phrase de référence: "${data.reference}"
Ce que l'apprenant a prononcé (transcription automatique): "${data.transcript}"
Mots probablement mal prononcés: ${wrong.length ? wrong.join(", ") : "(aucun)"}

Renvoie un JSON:
{
  "fluency": <0-100 entier, fluidité et naturel>,
  "nativeProximity": <0-100 entier, proximité globale avec la prononciation native>,
  "advice": [1 à 3 conseils courts et bienveillants en ${data.uiLang === "fr" ? "français" : "anglais"}],
  "phoneticTip": "<un conseil phonétique concret sur un son ou un mot précis, en ${data.uiLang === "fr" ? "français" : "anglais"}>",
  "wordHints": { ${wrong.length ? '"<mot>": "<indication phonétique brève, ex: /θɪŋk/ ou \'prononce le -e final\'>"' : ""} },
  "phonemeIssues": [ ${wrong.length ? '{ "word": "<mot>", "phoneme": "<IPA du son fautif, ex: /θ/>", "tip": "<geste articulatoire concret>" }' : ""} ],
  "grammarIssues": [
    { "issue": "<extrait fautif de la transcription (accord, conjugaison, ordre)>", "correction": "<version corrigée>" }
  ],
  "trainingPlan": [
    { "title": "<titre court>", "why": "<raison liée à ${data.lang}>", "howto": "<geste pratique 1-2 phrases>", "durationMin": <2|3|5>, "focus": "phoneme|grammar|fluency|rhythm|vocab" },
    { "title": "...", "why": "...", "howto": "...", "durationMin": <int>, "focus": "..." },
    { "title": "...", "why": "...", "howto": "...", "durationMin": <int>, "focus": "..." }
  ]
}`;

    let phoneticTip = "";
    let advice: string[] = [];
    let wordHints: Record<string, string> = {};
    let fluency = 70;
    let nativeProximity: number | undefined;
    let grammarIssues: { issue: string; correction: string }[] = [];
    let phonemeIssues: { word: string; phoneme: string; tip: string }[] = [];
    let trainingPlan: PronunciationResult["trainingPlan"] = undefined;

    try {
      const res = await fetch(`${aiBaseUrl()}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: aiChatModel(),
          messages: [
            { role: "system", content: sys },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const raw = j.choices?.[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(raw) as {
          fluency?: number;
          advice?: string[];
          phoneticTip?: string;
          wordHints?: Record<string, string>;
          nativeProximity?: number;
          grammarIssues?: { issue: string; correction: string }[];
          phonemeIssues?: { word: string; phoneme: string; tip: string }[];
          trainingPlan?: NonNullable<PronunciationResult["trainingPlan"]>;
        };
        if (typeof parsed.fluency === "number")
          fluency = Math.max(0, Math.min(100, Math.round(parsed.fluency)));
        if (Array.isArray(parsed.advice)) advice = parsed.advice.slice(0, 3);
        if (typeof parsed.phoneticTip === "string") phoneticTip = parsed.phoneticTip;
        if (parsed.wordHints && typeof parsed.wordHints === "object") wordHints = parsed.wordHints;
        if (typeof parsed.nativeProximity === "number")
          nativeProximity = Math.max(0, Math.min(100, Math.round(parsed.nativeProximity)));
        if (Array.isArray(parsed.grammarIssues))
          grammarIssues = parsed.grammarIssues
            .filter((g) => g && typeof g.issue === "string" && typeof g.correction === "string")
            .slice(0, 4);
        if (Array.isArray(parsed.phonemeIssues))
          phonemeIssues = parsed.phonemeIssues
            .filter((p) => p && typeof p.word === "string" && typeof p.tip === "string")
            .slice(0, 5);
        if (Array.isArray(parsed.trainingPlan))
          trainingPlan = parsed.trainingPlan
            .filter((e) => e && typeof e.title === "string" && typeof e.howto === "string")
            .slice(0, 3)
            .map((e) => ({
              title: e.title,
              why: typeof e.why === "string" ? e.why : "",
              howto: e.howto,
              durationMin:
                typeof e.durationMin === "number" && e.durationMin > 0
                  ? Math.min(15, Math.round(e.durationMin))
                  : 3,
              focus: e.focus ?? "fluency",
            }));
      }
    } catch {
      // fall through with defaults
    }

    const wordsWithHints: WordCheck[] = words.map((w) =>
      w.ok ? w : { ...w, hint: wordHints[w.word] ?? wordHints[w.word.toLowerCase()] },
    );

    return {
      accuracy,
      fluency,
      passed: accuracy >= 75,
      words: wordsWithHints,
      advice,
      phoneticTip,
      nativeProximity: nativeProximity ?? Math.round((accuracy + fluency) / 2),
      grammarIssues,
      phonemeIssues,
      trainingPlan,
    };
  });
