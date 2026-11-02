import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiApiKey, aiBaseUrl, aiChatModel } from "./ai-config.server";


const PostureSchema = z.object({
  gazeCameraPct: z.number(),
  postureScore: z.number(),
  stabilityScore: z.number(),
  expressivity: z.number(),
  handsUsagePct: z.number(),
  headTiltAvgDeg: z.number(),
  shoulderTiltAvgDeg: z.number(),
  samples: z.number(),
});

const HesitationsSchema = z.object({
  total: z.number(),
  perMinute: z.number(),
  fillers: z.number(),
  pauses: z.number(),
  repetitions: z.number(),
});

const MarkersSchema = z
  .array(
    z.object({
      t: z.number(),
      kind: z.enum(["gaze_away", "slouch", "steady", "filler", "pause", "repetition"]),
      note: z.string().optional(),
    }),
  )
  .max(60);

const SynthesizeInput = z.object({
  lang: z.enum(["fr", "en"]).default("fr"),
  prompt: z.string().optional(),
  durationSec: z.number().positive(),
  transcript: z.string().default(""),
  posture: PostureSchema,
  hesitations: HesitationsSchema,
  markers: MarkersSchema.default([]),
});

export type VideoSuggestion = { title: string; how: string; focus: "posture" | "gaze" | "voice" };
export type VideoSynthesis = {
  summary: string;
  posture_note: string;
  gaze_note: string;
  voice_note: string;
  suggestions: VideoSuggestion[];
};

export const synthesizeVideoFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => SynthesizeInput.parse(v))
  .handler(async ({ data, context }): Promise<VideoSynthesis & { id: string }> => {
    const key = aiApiKey();

    const sys =
      data.lang === "fr"
        ? "Tu es ALESIM, coach bienveillant en prise de parole. On te fournit des métriques calculées localement (posture, regard, hésitations) issues d'un enregistrement vidéo. Formule un feedback chaleureux, factuel, orienté progrès, en tutoyant. Réponds UNIQUEMENT en JSON valide."
        : "You are ALESIM, a warm public-speaking coach. You are given locally-computed metrics (posture, gaze, hesitations) from a video recording. Reply with a warm, factual, progress-oriented feedback. Reply ONLY in valid JSON.";

    const user =
      (data.prompt ? `Exercice: ${data.prompt}\n\n` : "") +
      `Durée: ${data.durationSec.toFixed(1)}s\n` +
      `Regard caméra: ${data.posture.gazeCameraPct}%\n` +
      `Score posture: ${data.posture.postureScore}/100 (inclinaison épaules ${data.posture.shoulderTiltAvgDeg}°, tête ${data.posture.headTiltAvgDeg}°)\n` +
      `Stabilité: ${data.posture.stabilityScore}/100, expressivité: ${data.posture.expressivity}/100, gestuelle visible: ${data.posture.handsUsagePct}%\n` +
      `Hésitations: ${data.hesitations.total} (${data.hesitations.perMinute}/min) — fillers ${data.hesitations.fillers}, pauses ${data.hesitations.pauses}, répétitions ${data.hesitations.repetitions}\n` +
      (data.transcript ? `\nExtrait de transcription:\n"${data.transcript.slice(0, 800)}"\n` : "") +
      `\nRenvoie un JSON strict:\n{\n  "summary": "<2-3 phrases bienveillantes qui résument la séance>",\n  "posture_note": "<1-2 phrases spécifiques sur la posture>",\n  "gaze_note": "<1-2 phrases sur le contact visuel caméra>",\n  "voice_note": "<1-2 phrases sur la voix/hésitations>",\n  "suggestions": [\n    { "title": "<micro-conseil actionnable>", "how": "<1 phrase pratique>", "focus": "posture|gaze|voice" },\n    { "title": "...", "how": "...", "focus": "..." },\n    { "title": "...", "how": "...", "focus": "..." }\n  ]\n}\nExactement 3 suggestions couvrant idéalement les 3 axes. Aucun markdown, uniquement le JSON.`;

    const res = await fetch(`${aiBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
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
      throw new Error(`Video synthesis failed: ${res.status} ${err}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: Partial<VideoSynthesis> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }
    const synthesis: VideoSynthesis = {
      summary: parsed.summary ?? "",
      posture_note: parsed.posture_note ?? "",
      gaze_note: parsed.gaze_note ?? "",
      voice_note: parsed.voice_note ?? "",
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions
            .filter((s) => s && typeof s.title === "string")
            .slice(0, 3)
            .map((s) => ({
              title: String(s.title),
              how: String(s.how ?? ""),
              focus: (["posture", "gaze", "voice"].includes(String(s.focus))
                ? s.focus
                : "voice") as VideoSuggestion["focus"],
            }))
        : [],
    };

    const { data: inserted, error } = await context.supabase
      .from("video_sessions")
      .insert({
        user_id: context.userId,
        prompt: data.prompt ?? null,
        lang: data.lang,
        duration_sec: Math.round(data.durationSec),
        transcript: data.transcript,
        posture_metrics: data.posture,
        gaze_camera_pct: data.posture.gazeCameraPct,
        hesitation_metrics: data.hesitations,
        summary: synthesis.summary,
        suggestions: synthesis.suggestions,
        markers: data.markers,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ...synthesis, id: inserted.id };
  });

export const listVideoSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("video_sessions")
      .select(
        "id, prompt, lang, duration_sec, gaze_camera_pct, posture_metrics, hesitation_metrics, summary, suggestions, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const DeleteInput = z.object({ id: z.string().uuid() });

export const deleteVideoSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => DeleteInput.parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("video_sessions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
