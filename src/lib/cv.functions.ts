import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiApiKey, aiBaseUrl, aiChatModel } from "./ai-config.server";


const AnalyzeInput = z.object({
  extractedText: z.string().min(50, "CV text too short").max(60_000),
  fileName: z.string().min(1).max(200),
  fileKind: z.enum(["pdf", "docx", "image"]),
  targetRole: z.string().max(200).optional(),
  lang: z.enum(["fr", "en"]).default("fr"),
});

export type CvAxis = {
  title: string;
  problem: string;
  example: string;
  correction: string;
  impact: "fort" | "moyen" | "faible";
};
export type CvAnalysis = {
  score: number;
  summary: string;
  tone_note: string;
  axes: CvAxis[];
  keywords: string[];
  suggested_lesson_theme: string | null;
};

function stripFences(t: string) {
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (m ? m[1] : t).trim();
}

async function callGemini(sys: string, user: string, key: string): Promise<CvAnalysis> {
  const res = await fetch(`${aiBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: aiChatModel("google/gemini-2.5-flash"),
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI gateway ${res.status}: ${body}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(stripFences(content)) as Partial<CvAnalysis>;
  const axes = Array.isArray(parsed.axes) ? parsed.axes.slice(0, 5) : [];
  return {
    score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
    summary: String(parsed.summary ?? "").slice(0, 800),
    tone_note: String(parsed.tone_note ?? "").slice(0, 400),
    axes: axes.map((raw) => {
      const a = (raw ?? {}) as Record<string, unknown>;
      const impact = String(a["impact"] ?? "");
      return {
        title: String(a["title"] ?? "").slice(0, 120),
        problem: String(a["problem"] ?? "").slice(0, 500),
        example: String(a["example"] ?? "").slice(0, 500),
        correction: String(a["correction"] ?? "").slice(0, 800),
        impact: (["fort", "moyen", "faible"] as readonly string[]).includes(impact)
          ? (impact as "fort" | "moyen" | "faible")
          : ("moyen" as const),
      };
    }),
    keywords: Array.isArray(parsed.keywords)
      ? parsed.keywords.slice(0, 12).map((k) => String(k).slice(0, 40))
      : [],
    suggested_lesson_theme: parsed.suggested_lesson_theme
      ? String(parsed.suggested_lesson_theme).slice(0, 60)
      : null,
  };
}

function buildPrompt(lang: "fr" | "en", extractedText: string, targetRole?: string) {
  if (lang === "fr") {
    return {
      sys: "Tu es ALESIM, coach bienveillant en communication professionnelle. Tu analyses un CV pour aider la personne à mieux valoriser son parcours. Tu es factuel, constructif, jamais dévalorisant. Tu tutoies. Tu réponds UNIQUEMENT en JSON valide, sans markdown.",
      user:
        (targetRole ? `Poste visé: ${targetRole}\n\n` : "") +
        `Texte extrait du CV (peut contenir des artefacts d'OCR ou de mise en page) :\n"""${extractedText.slice(0, 20_000)}"""\n\n` +
        `Analyse ce CV selon 6 dimensions : structure/lisibilité, contenu et résultats chiffrés, orthographe/formulation, ${targetRole ? "cohérence avec le poste visé, " : ""}informations de contact (sans juger la photo si mentionnée), ton et niveau de confiance perçu.\n\n` +
        `Renvoie STRICTEMENT ce JSON :\n{\n  "score": <entier 0-100 indicatif>,\n  "summary": "<2-3 phrases bienveillantes qui résument la qualité globale du CV>",\n  "tone_note": "<1-2 phrases sur le niveau de confiance qui transparaît>",\n  "axes": [\n    { "title": "<titre court>", "problem": "<problème identifié>", "example": "<extrait précis du CV ou synthèse fidèle>", "correction": "<réécriture concrète prête à copier-coller>", "impact": "fort|moyen|faible" }\n  ],\n  "keywords": [${targetRole ? '"<mot-clé du poste manquant ou à renforcer>"' : ""}],\n  "suggested_lesson_theme": "<confiance|articulation|débit|structure|null>"\n}\n\nEntre 3 et 5 axes maximum, priorisés par impact décroissant. ${targetRole ? "Remplis keywords avec 5 à 10 mots-clés pertinents pour le poste visé." : "Laisse keywords vide."} Si le ton manque de confiance, mets suggested_lesson_theme=confiance.`,
    };
  }
  return {
    sys: "You are ALESIM, a warm coach for professional communication. You review a résumé to help the person tell their story better. You are factual, constructive, never disparaging. Reply ONLY with valid JSON, no markdown.",
    user:
      (targetRole ? `Target role: ${targetRole}\n\n` : "") +
      `Extracted résumé text (may contain OCR/layout artifacts):\n"""${extractedText.slice(0, 20_000)}"""\n\n` +
      `Return STRICTLY this JSON:\n{\n  "score": <integer 0-100>,\n  "summary": "<2-3 warm sentences summarizing overall quality>",\n  "tone_note": "<1-2 sentences on the confidence conveyed>",\n  "axes": [\n    { "title": "<short title>", "problem": "<issue>", "example": "<faithful excerpt from résumé>", "correction": "<concrete rewrite ready to paste>", "impact": "fort|moyen|faible" }\n  ],\n  "keywords": [${targetRole ? '"<missing keyword from job>"' : ""}],\n  "suggested_lesson_theme": "<confidence|articulation|pace|structure|null>"\n}\n\n3 to 5 axes maximum, sorted by decreasing impact. ${targetRole ? "Fill keywords with 5-10 role-relevant terms." : "Leave keywords empty."} If tone lacks confidence, set suggested_lesson_theme=confiance.`,
  };
}

export const analyzeCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => AnalyzeInput.parse(v))
  .handler(async ({ data, context }) => {
    const key = aiApiKey();
    const { sys, user } = buildPrompt(data.lang, data.extractedText, data.targetRole);
    const analysis = await callGemini(sys, user, key);

    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("cv_analyses")
      .insert({
        user_id: userId,
        file_name: data.fileName,
        file_kind: data.fileKind,
        extracted_text: data.extractedText.slice(0, 40_000),
        target_role: data.targetRole ?? null,
        lang: data.lang,
        score: analysis.score,
        summary: analysis.summary,
        tone_note: analysis.tone_note,
        axes: analysis.axes,
        keywords: analysis.keywords,
        suggested_lesson_theme: analysis.suggested_lesson_theme,
      })
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);

    try {
      const { checkAndUnlockBadgesFor } = await import("./badges.server");
      await checkAndUnlockBadgesFor(supabase, userId);
    } catch {
      // best-effort
    }

    return { id: row.id as string, created_at: row.created_at as string, ...analysis };
  });

export const regenerateAxis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        analysisId: z.string().uuid(),
        axisIndex: z.number().int().min(0).max(4),
      })
      .parse(v),
  )
  .handler(async ({ data, context }): Promise<{ axis: CvAxis }> => {
    const key = aiApiKey();
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("cv_analyses")
      .select("extracted_text, target_role, lang, axes")
      .eq("id", data.analysisId)
      .eq("user_id", userId)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Not found");
    const axes = Array.isArray(row.axes) ? (row.axes as unknown as CvAxis[]) : [];
    const target = axes[data.axisIndex];
    if (!target) throw new Error("Axis not found");

    const lang = (row.lang as "fr" | "en") ?? "fr";
    const sys =
      lang === "fr"
        ? "Tu es ALESIM. Tu proposes UNE variante de correction pour un axe d'amélioration de CV. Réponds UNIQUEMENT en JSON."
        : "You are ALESIM. Propose ONE fresh rewrite variant for a résumé improvement. Reply ONLY in JSON.";
    const user =
      `${lang === "fr" ? "CV extrait" : "Résumé excerpt"}: """${String(row.extracted_text).slice(0, 8_000)}"""\n` +
      (row.target_role
        ? `${lang === "fr" ? "Poste visé" : "Target role"}: ${row.target_role}\n`
        : "") +
      `${lang === "fr" ? "Axe à retravailler" : "Axis to rework"}: ${target.title}\nProblème: ${target.problem}\nExemple: ${target.example}\n` +
      `${lang === "fr" ? "Ancienne correction" : "Previous rewrite"}: ${target.correction}\n\n` +
      `Renvoie JSON: { "title": "...", "problem": "...", "example": "...", "correction": "<réécriture différente, actionnable>", "impact": "fort|moyen|faible" }`;

    const res = await fetch(`${aiBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: aiChatModel("google/gemini-2.5-flash"),
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        temperature: 0.75,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`AI gateway ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(stripFences(json.choices?.[0]?.message?.content ?? "{}"));
    const fresh: CvAxis = {
      title: String(parsed.title ?? target.title).slice(0, 120),
      problem: String(parsed.problem ?? target.problem).slice(0, 500),
      example: String(parsed.example ?? target.example).slice(0, 500),
      correction: String(parsed.correction ?? target.correction).slice(0, 800),
      impact: (["fort", "moyen", "faible"] as const).includes(parsed.impact)
        ? parsed.impact
        : target.impact,
    };

    axes[data.axisIndex] = fresh;
    const { error: uerr } = await supabase
      .from("cv_analyses")
      .update({ axes })
      .eq("id", data.analysisId)
      .eq("user_id", userId);
    if (uerr) throw new Error(uerr.message);
    return { axis: fresh };
  });

export const listMyCvAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("cv_analyses")
      .select("id, file_name, file_kind, target_role, score, summary, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getCvAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("cv_analyses")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Not found");
    return row;
  });

export const deleteCvAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("cv_analyses")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
