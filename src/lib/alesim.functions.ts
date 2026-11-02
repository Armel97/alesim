import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { aiApiKey, aiBaseUrl, aiChatModel, aiTranscribeModel } from "./ai-config.server";


const TranscribeInput = z.object({
  audioBase64: z.string().min(1),
  mimeType: z.string().default("audio/wav"),
  lang: z.enum(["fr", "en"]).default("fr"),
});

export type TranscribedWord = { word: string; start: number; end: number };

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => TranscribeInput.parse(v))
  .handler(async ({ data }) => {
    const key = aiApiKey();

    const bin = atob(data.audioBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: data.mimeType });

    const form = new FormData();
    form.append("file", blob, "recording.wav");
    // Whisper-1 exposes word-level timestamps via verbose_json, which we need
    // to locate hesitations precisely inside the recording.
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
      duration?: number;
      words?: { word: string; start: number; end: number }[];
    };
    const words: TranscribedWord[] = Array.isArray(json.words)
      ? json.words.map((w) => ({
          word: String(w.word ?? ""),
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

const FeedbackInput = z.object({
  transcript: z.string().min(1),
  durationSec: z.number().positive(),
  lang: z.enum(["fr", "en"]).default("fr"),
  prompt: z.string().optional(),
});

export type FeedbackResult = {
  wpm: number;
  clarity: number;
  confidence: number;
  fillerCount: number;
  strengths: string[];
  improvements: string[];
  nextChallenge: string;
  fillers?: { word: string; count: number }[];
  paceTarget?: { min: number; max: number };
  paceVerdict?: "slow" | "ideal" | "fast";
  paceNote?: string;
  longSentences?: { original: string; suggestion: string }[];
  toneVariation?: number; // 0-100 perceived intonation variation
  toneNote?: string;
  trainingPlan?: TrainingExercise[];
};

export type TrainingExercise = {
  title: string;
  why: string;
  howto: string;
  durationMin: number;
  focus: "fillers" | "pace" | "structure" | "tone" | "confidence" | "clarity";
};

export const analyzeSpeech = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => FeedbackInput.parse(v))
  .handler(async ({ data }): Promise<FeedbackResult> => {
    const key = aiApiKey();

    const words = data.transcript.trim().split(/\s+/).filter(Boolean).length;
    const wpm = Math.round((words / data.durationSec) * 60);

    // Deterministic filler detection (backup for LLM)
    const fillerLexicon =
      data.lang === "fr"
        ? [
            "euh",
            "euhm",
            "hum",
            "heu",
            "bah",
            "ben",
            "genre",
            "voilà",
            "du coup",
            "en fait",
            "tu vois",
            "quoi",
          ]
        : [
            "uh",
            "um",
            "erm",
            "like",
            "you know",
            "sort of",
            "kind of",
            "basically",
            "actually",
            "literally",
          ];
    const lower = ` ${data.transcript.toLowerCase()} `;
    const detected: { word: string; count: number }[] = [];
    for (const f of fillerLexicon) {
      const re = new RegExp(`(?<![\\p{L}])${f.replace(/ /g, "\\s+")}(?![\\p{L}])`, "giu");
      const m = lower.match(re);
      if (m && m.length) detected.push({ word: f, count: m.length });
    }
    detected.sort((a, b) => b.count - a.count);

    // Long-sentence detection (>28 words)
    const rawSentences = data.transcript
      .split(/(?<=[.!?…])\s+|\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const longOnes = rawSentences.filter((s) => s.split(/\s+/).length > 28).slice(0, 3);

    // Pace target range
    const paceTarget = { min: 130, max: 160 };
    const paceVerdict: "slow" | "ideal" | "fast" =
      wpm < paceTarget.min ? "slow" : wpm > paceTarget.max ? "fast" : "ideal";

    const sys =
      data.lang === "fr"
        ? "Tu es ALESIM, un coach vocal bienveillant, expert en prise de parole, aide aux bègues et confiance en soi. Analyse la transcription fournie et réponds STRICTEMENT en JSON valide. Sois concret, chaleureux, jamais moralisateur. Utilise le tutoiement."
        : "You are ALESIM, a warm vocal coach expert in public speaking, stuttering support and self-confidence. Analyze the transcript and reply STRICTLY as valid JSON. Be concrete, warm, never preachy.";

    const user =
      (data.prompt ? `Exercice: ${data.prompt}\n\n` : "") +
      `Transcription (${data.durationSec.toFixed(1)}s, ~${wpm} mots/min):\n"${data.transcript}"\n\n` +
      `Cible de débit idéale: ${paceTarget.min}-${paceTarget.max} mots/min. Verdict actuel: ${paceVerdict}.\n` +
      (longOnes.length
        ? `Phrases jugées longues à reformuler:\n${longOnes.map((s, i) => `${i + 1}. "${s}"`).join("\n")}\n\n`
        : "") +
      `Renvoie un JSON avec ces clés exactes:
{
  "clarity": <0-100 entier, clarté du propos>,
  "confidence": <0-100 entier, assurance perçue>,
  "fillerCount": <nombre d'hésitations "euh", "hum", répétitions>,
  "strengths": [2 ou 3 phrases courtes en ${data.lang === "fr" ? "français" : "anglais"}],
  "improvements": [2 ou 3 conseils actionnables et bienveillants],
  "nextChallenge": "<un défi court et motivant pour la prochaine séance>",
  "paceNote": "<une phrase bienveillante sur le débit, en ${data.lang === "fr" ? "français" : "anglais"}>",
  "toneVariation": <0-100 entier, richesse de l'intonation perçue à partir du texte (ponctuation, questions, exclamations, variété lexicale)>,
  "toneNote": "<une phrase courte sur l'intonation, ${data.lang === "fr" ? "français" : "anglais"}>",
  "longSentenceSuggestions": [
    ${longOnes.map((s) => `{ "original": ${JSON.stringify(s)}, "suggestion": "<reformulation plus claire et fluide>" }`).join(",\n    ")}
  ],
  "trainingPlan": [
    { "title": "<titre court d'un exercice ciblé sur la faiblesse principale>", "why": "<raison bienveillante liée à ce qui vient d'être dit>", "howto": "<comment le faire, 1-2 phrases pratiques>", "durationMin": <2|3|5|10>, "focus": "fillers|pace|structure|tone|confidence|clarity" },
    { "title": "...", "why": "...", "howto": "...", "durationMin": <entier>, "focus": "..." },
    { "title": "...", "why": "...", "howto": "...", "durationMin": <entier>, "focus": "..." }
  ]
}
Le trainingPlan contient EXACTEMENT 3 exercices bienveillants, progressifs (court→plus long), ciblés sur les faiblesses détectées (débit, béquilles, phrases longues, intonation). Ne renvoie que le JSON, sans texte autour, sans markdown.`;

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
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Feedback failed: ${res.status} ${err}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: Partial<FeedbackResult> & {
      longSentenceSuggestions?: { original: string; suggestion: string }[];
      trainingPlan?: TrainingExercise[];
    } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    return {
      wpm,
      clarity: clamp(parsed.clarity ?? 70),
      confidence: clamp(parsed.confidence ?? 65),
      fillerCount: Math.max(
        detected.reduce((s, f) => s + f.count, 0),
        Math.round(parsed.fillerCount ?? 0),
      ),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 3) : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, 3) : [],
      nextChallenge: parsed.nextChallenge ?? "",
      fillers: detected.slice(0, 6),
      paceTarget,
      paceVerdict,
      paceNote: typeof parsed.paceNote === "string" ? parsed.paceNote : undefined,
      longSentences: Array.isArray(parsed.longSentenceSuggestions)
        ? parsed.longSentenceSuggestions
            .filter((x) => x && typeof x.original === "string" && typeof x.suggestion === "string")
            .slice(0, 3)
        : longOnes.map((original) => ({ original, suggestion: "" })),
      toneVariation:
        typeof parsed.toneVariation === "number" ? clamp(parsed.toneVariation) : undefined,
      toneNote: typeof parsed.toneNote === "string" ? parsed.toneNote : undefined,
      trainingPlan: Array.isArray(parsed.trainingPlan)
        ? parsed.trainingPlan
            .filter(
              (e): e is TrainingExercise =>
                !!e && typeof e.title === "string" && typeof e.howto === "string",
            )
            .slice(0, 3)
            .map((e) => ({
              title: e.title,
              why: typeof e.why === "string" ? e.why : "",
              howto: e.howto,
              durationMin:
                typeof e.durationMin === "number" && e.durationMin > 0
                  ? Math.min(15, Math.round(e.durationMin))
                  : 3,
              focus: e.focus ?? "clarity",
            }))
        : undefined,
    };
  });

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}
