import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiApiKey, aiBaseUrl, aiChatModel } from "./ai-config.server";


export type InterviewType = "rh" | "technique" | "managerial" | "libre";
export type InterviewDifficulty = "basique" | "standard" | "avance";
export type InterviewFormat = "audio" | "video";

export type InterviewQuestion = {
  text: string;
  kind: string;
  level: InterviewDifficulty;
};

export type StarPart = {
  status: "present" | "partial" | "absent";
  excerpt: string;
  suggestion: string;
};

export type StarAnalysis = {
  situation: StarPart;
  tache: StarPart;
  action: StarPart;
  resultat: StarPart;
  quantified: boolean;
  structureScore: number;
  overallNote: string;
};

export type FormMetrics = {
  wpm?: number;
  hesitations?: number;
  hesitationsPerMin?: number;
  fillers?: number;
  pauses?: number;
  postureScore?: number;
  gazeCameraPct?: number;
  stabilityScore?: number;
  expressivity?: number;
  handsUsagePct?: number;
};

function stripFences(t: string) {
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (m ? m[1] : t).trim();
}

type JsonRecord = Record<string, unknown>;

async function chatJson(sys: string, user: string, temperature = 0.6): Promise<JsonRecord> {
  const key = aiApiKey();
  const res = await fetch(`${aiBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: aiChatModel(),
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("RATE_LIMIT");
    if (res.status === 402) throw new Error("NO_CREDITS");
    throw new Error(`AI gateway ${res.status}: ${body}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return JSON.parse(stripFences(json.choices?.[0]?.message?.content ?? "{}"));
}

const GenInput = z.object({
  interviewType: z.enum(["rh", "technique", "managerial", "libre"]).default("rh"),
  targetRole: z.string().max(160).optional(),
  sector: z.string().max(160).optional(),
  difficulty: z.enum(["basique", "standard", "avance"]).default("standard"),
  format: z.enum(["audio", "video"]).default("audio"),
  lang: z.enum(["fr", "en"]).default("fr"),
  count: z.number().int().min(5).max(8).default(6),
});

const TYPE_LABEL: Record<InterviewType, { fr: string; en: string }> = {
  rh: { fr: "premier entretien RH", en: "first HR screening" },
  technique: { fr: "entretien technique", en: "technical interview" },
  managerial: { fr: "entretien managérial", en: "managerial interview" },
  libre: { fr: "mode libre (questions variées)", en: "free mode (varied questions)" },
};

export const generateInterviewQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => GenInput.parse(v))
  .handler(async ({ data, context }) => {
    const fr = data.lang === "fr";
    const sys = fr
      ? "Tu es ALESIM, coach bienveillant en communication professionnelle. Tu prépares des questions d'entretien d'embauche. Tu tutoies. Tu réponds UNIQUEMENT en JSON valide, sans markdown."
      : "You are ALESIM, a warm professional-communication coach preparing job interview questions. Reply ONLY with valid JSON, no markdown.";
    const user =
      `${fr ? "Type d'entretien" : "Interview type"}: ${TYPE_LABEL[data.interviewType][data.lang]}\n` +
      (data.targetRole ? `${fr ? "Poste visé" : "Target role"}: ${data.targetRole}\n` : "") +
      (data.sector ? `${fr ? "Secteur" : "Sector"}: ${data.sector}\n` : "") +
      `${fr ? "Niveau" : "Level"}: ${data.difficulty}\n\n` +
      (fr
        ? `Génère ${data.count} questions d'entretien, majoritairement comportementales (elles doivent se prêter à une réponse structurée en STAR : Situation, Tâche, Action, Résultat). Varie les thèmes (conflit, réussite, échec, initiative, collaboration, pression). Formule-les comme un vrai recruteur, en tutoyant.\n`
        : `Generate ${data.count} interview questions, mostly behavioral (they must lend themselves to a STAR-structured answer). Vary the themes (conflict, success, failure, initiative, collaboration, pressure). Phrase them like a real recruiter.\n`) +
      `JSON: { "questions": [ { "text": "...", "kind": "${fr ? "comportementale|technique|motivation|situationnelle" : "behavioral|technical|motivation|situational"}", "level": "basique|standard|avance" } ] }`;

    const parsed = await chatJson(sys, user, 0.85);
    const rawList = Array.isArray(parsed?.questions) ? parsed.questions : [];
    const questions: InterviewQuestion[] = rawList
      .filter((q: JsonRecord) => q && typeof q["text"] === "string" && q["text"].trim())
      .slice(0, data.count)
      .map((q: JsonRecord) => ({
        text: String(q["text"]).slice(0, 400),
        kind: String(q["kind"] ?? "comportementale").slice(0, 40),
        level: (["basique", "standard", "avance"] as readonly string[]).includes(String(q["level"]))
          ? (q["level"] as InterviewQuestion["level"])
          : data.difficulty,
      }));
    if (!questions.length) throw new Error("No questions generated");

    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("interview_simulations")
      .insert({
        user_id: userId,
        interview_type: data.interviewType,
        target_role: data.targetRole ?? null,
        sector: data.sector ?? null,
        difficulty: data.difficulty,
        format: data.format,
        lang: data.lang,
        questions: questions as unknown as never,
      })
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);

    return { id: row.id as string, createdAt: row.created_at as string, questions };
  });

const AnalyzeInput = z.object({
  simulationId: z.string().uuid(),
  questionIndex: z.number().int().min(0).max(20),
  questionText: z.string().min(3).max(400),
  transcript: z.string().min(1).max(12_000),
  durationSec: z.number().min(0).max(3600),
  lang: z.enum(["fr", "en"]).default("fr"),
  formMetrics: z
    .object({
      wpm: z.number().optional(),
      hesitations: z.number().optional(),
      hesitationsPerMin: z.number().optional(),
      fillers: z.number().optional(),
      pauses: z.number().optional(),
      postureScore: z.number().optional(),
      gazeCameraPct: z.number().optional(),
      stabilityScore: z.number().optional(),
      expressivity: z.number().optional(),
      handsUsagePct: z.number().optional(),
    })
    .default({}),
});

function normalizePart(raw: unknown): StarPart {
  const p = (raw ?? {}) as JsonRecord;
  const status = (["present", "partial", "absent"] as readonly string[]).includes(
    String(p["status"]),
  )
    ? (p["status"] as StarPart["status"])
    : "absent";
  return {
    status,
    excerpt: String(p["excerpt"] ?? "").slice(0, 600),
    suggestion: String(p["suggestion"] ?? "").slice(0, 600),
  };
}

export const analyzeStarResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => AnalyzeInput.parse(v))
  .handler(async ({ data, context }) => {
    const fr = data.lang === "fr";
    const sys = fr
      ? "Tu es ALESIM, coach bienveillant en entretien d'embauche. Tu évalues la STRUCTURE d'une réponse selon la méthode STAR. Ton toujours constructif : une composante manquante est une piste d'amélioration, jamais une erreur. Tu tutoies. Tu réponds UNIQUEMENT en JSON valide, sans markdown."
      : "You are ALESIM, a warm interview coach. You assess the STRUCTURE of an answer with the STAR method. Always constructive: a missing part is an opportunity, never a mistake. Reply ONLY with valid JSON, no markdown.";
    const user =
      `${fr ? "Question posée" : "Question asked"}: "${data.questionText}"\n\n` +
      `${fr ? "Transcription de la réponse" : "Answer transcript"} (${Math.round(data.durationSec)}s):\n"""${data.transcript}"""\n\n` +
      (fr
        ? `Pour chacune des 4 composantes STAR (situation, tache, action, resultat), indique :\n- status: "present" (clairement développée), "partial" (évoquée mais trop courte/vague) ou "absent"\n- excerpt: l'extrait exact de la transcription correspondant (chaîne vide si absent)\n- suggestion: une phrase concrète et encourageante pour enrichir cette partie (reformulation possible)\nVérifie aussi si le Résultat contient un élément concret ou chiffré.\n`
        : `For each of the 4 STAR parts (situation, tache, action, resultat) return:\n- status: "present", "partial" or "absent"\n- excerpt: matching excerpt from the transcript (empty if absent)\n- suggestion: one concrete, encouraging sentence to enrich this part\nAlso check whether the Result contains a concrete or quantified element.\n`) +
      `JSON: {
  "situation": { "status": "...", "excerpt": "...", "suggestion": "..." },
  "tache": { "status": "...", "excerpt": "...", "suggestion": "..." },
  "action": { "status": "...", "excerpt": "...", "suggestion": "..." },
  "resultat": { "status": "...", "excerpt": "...", "suggestion": "..." },
  "quantified": <true|false>,
  "structureScore": <${fr ? "entier" : "integer"} 0-100>,
  "overallNote": "<2 ${fr ? "phrases bienveillantes de synthèse" : "warm summary sentences"}>"
}`;

    const parsed = await chatJson(sys, user, 0.4);
    const star: StarAnalysis = {
      situation: normalizePart(parsed?.situation),
      tache: normalizePart(parsed?.tache),
      action: normalizePart(parsed?.action),
      resultat: normalizePart(parsed?.resultat),
      quantified: Boolean(parsed?.quantified),
      structureScore: Math.max(0, Math.min(100, Math.round(Number(parsed?.structureScore) || 0))),
      overallNote: String(parsed?.overallNote ?? "").slice(0, 600),
    };

    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("interview_responses")
      .insert({
        user_id: userId,
        simulation_id: data.simulationId,
        question_index: data.questionIndex,
        question_text: data.questionText,
        transcript: data.transcript.slice(0, 12_000),
        duration_sec: Math.round(data.durationSec),
        lang: data.lang,
        star: star as unknown as never,
        structure_score: star.structureScore,
        overall_note: star.overallNote,
        form_metrics: data.formMetrics as unknown as never,
      })
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);

    let unlocked: { code: string; icon: string; title_fr: string; title_en: string }[] = [];
    try {
      const { checkAndUnlockBadgesFor } = await import("./badges.server");
      unlocked = await checkAndUnlockBadgesFor(supabase, userId);
    } catch {
      // best-effort
    }

    return { id: row.id as string, createdAt: row.created_at as string, star, unlocked };
  });

export const generateStarExample = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        responseId: z.string().uuid(),
        questionText: z.string().min(3).max(400),
        transcript: z.string().max(12_000).default(""),
        targetRole: z.string().max(160).optional(),
        lang: z.enum(["fr", "en"]).default("fr"),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const fr = data.lang === "fr";
    const sys = fr
      ? "Tu es ALESIM. Tu rédiges un exemple de réponse d'entretien parfaitement structurée en STAR, réaliste et concise. Réponds UNIQUEMENT en JSON."
      : "You are ALESIM. Write one realistic, concise interview answer perfectly structured with STAR. Reply ONLY in JSON.";
    const user =
      `${fr ? "Question" : "Question"}: "${data.questionText}"\n` +
      (data.targetRole ? `${fr ? "Poste visé" : "Target role"}: ${data.targetRole}\n` : "") +
      (data.transcript
        ? `${fr ? "Réponse de la personne (à t'inspirer, garde son contexte si possible)" : "The person's answer (keep their context if possible)"}: """${data.transcript.slice(0, 3000)}"""\n`
        : "") +
      `JSON: { "example": "<${fr ? "réponse modèle de 120-180 mots, avec les 4 étapes STAR clairement enchaînées et un résultat chiffré" : "120-180 word model answer, 4 STAR steps clearly chained, with a quantified result"}>" }`;
    const parsed = await chatJson(sys, user, 0.8);
    const example = String(parsed?.example ?? "").slice(0, 2000);

    const { supabase, userId } = context;
    await supabase
      .from("interview_responses")
      .update({ sample_answer: example })
      .eq("id", data.responseId)
      .eq("user_id", userId);
    return { example };
  });

export const listInterviewHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("interview_responses")
      .select(
        "id, simulation_id, question_index, question_text, transcript, structure_score, overall_note, star, form_metrics, duration_sec, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteInterviewResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("interview_responses")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
