import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiApiKey, aiBaseUrl, aiChatModel } from "./ai-config.server";


export type CoachExercise = {
  title: string;
  why: string;
  howto: string;
  durationMin: number;
  focus:
    | "fillers"
    | "pace"
    | "structure"
    | "tone"
    | "confidence"
    | "clarity"
    | "pronunciation"
    | "fluency";
  route: "today" | "practice" | "explore";
  routeParams?: Record<string, string>;
};

export type SkillProgression = {
  before: number;
  after: number;
  delta: number; // percentage points or %
  unit: "score" | "wpm" | "count";
};

export type CoachReport = {
  weekStart: string; // ISO date (Monday)
  summary: string;
  progressNote: string;
  prioritySkill: "pace" | "fillers" | "pronunciation" | "fluency" | "confidence" | "clarity";
  progression: Partial<
    Record<
      "pace" | "fillers" | "pronunciation" | "fluency" | "clarity" | "confidence",
      SkillProgression
    >
  >;
  metrics: {
    sampleSize: number;
    voiceSessions: number;
    pronunciationSessions: number;
    lessonsCompleted: number;
    weekLabel: string;
  };
  exercises: CoachExercise[];
  strengths: string[];
};

const VoiceSnap = z.object({
  createdAt: z.number(),
  wpm: z.number().optional(),
  clarity: z.number().optional(),
  confidence: z.number().optional(),
  fillerCount: z.number().optional(),
  toneVariation: z.number().optional(),
  durationSec: z.number().optional(),
});
const PronSnap = z.object({
  createdAt: z.number(),
  accuracy: z.number(),
  fluency: z.number(),
  passed: z.boolean().optional(),
  fillerCount: z.number().optional(),
  pauseCount: z.number().optional(),
});
const Input = z.object({
  lang: z.enum(["fr", "en"]).default("fr"),
  voice: z.array(VoiceSnap).max(50).default([]),
  pronunciation: z.array(PronSnap).max(50).default([]),
});

function isoMonday(d = new Date()): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dt.getUTCDay() || 7;
  if (day !== 1) dt.setUTCDate(dt.getUTCDate() - (day - 1));
  return dt.toISOString().slice(0, 10);
}

function avg(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}
function round(n: number, d = 1) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

type Half = { recent: number[]; prior: number[] };
function split<T>(arr: T[], f: (x: T) => number | undefined): Half {
  const vals = arr.map(f).filter((x): x is number => typeof x === "number" && !Number.isNaN(x));
  const mid = Math.ceil(vals.length / 2);
  return { recent: vals.slice(0, mid), prior: vals.slice(mid) };
}

export const generateCoachingReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => Input.parse(v))
  .handler(async ({ data, context }): Promise<CoachReport> => {
    const { supabase, userId } = context;

    // Pull last 15 lesson completions
    const { data: comps } = await supabase
      .from("lesson_completions")
      .select("wpm, duration_sec, completed_at, quiz_score, quiz_total")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(15);

    const lessonWpm = (comps ?? [])
      .map((c) => c.wpm)
      .filter((x): x is number => typeof x === "number");
    const voice = data.voice.slice(0, 15);
    const pron = data.pronunciation.slice(0, 15);
    const sampleSize = voice.length + pron.length + (comps?.length ?? 0);

    // Moving-average split (recent half vs prior half)
    const paceHalf = split(
      [...voice, ...(comps ?? []).map((c) => ({ wpm: c.wpm ?? undefined }))],
      (x) => (x as { wpm?: number }).wpm,
    );
    const fillerHalf = split(voice, (x) => x.fillerCount);
    const clarityHalf = split(voice, (x) => x.clarity);
    const confidenceHalf = split(voice, (x) => x.confidence);
    const toneHalf = split(voice, (x) => x.toneVariation);
    const accHalf = split(pron, (x) => x.accuracy);
    const fluHalf = split(pron, (x) => x.fluency);

    const progression: CoachReport["progression"] = {};
    const paceR = round(avg(paceHalf.recent));
    const paceP = round(avg(paceHalf.prior));
    if (paceR || paceP)
      progression.pace = { before: paceP, after: paceR, delta: round(paceR - paceP), unit: "wpm" };
    const fillR = round(avg(fillerHalf.recent));
    const fillP = round(avg(fillerHalf.prior));
    if (voice.length)
      progression.fillers = {
        before: fillP,
        after: fillR,
        delta: round(fillR - fillP),
        unit: "count",
      };
    const clR = round(avg(clarityHalf.recent));
    const clP = round(avg(clarityHalf.prior));
    if (voice.length)
      progression.clarity = { before: clP, after: clR, delta: round(clR - clP), unit: "score" };
    const cfR = round(avg(confidenceHalf.recent));
    const cfP = round(avg(confidenceHalf.prior));
    if (voice.length)
      progression.confidence = { before: cfP, after: cfR, delta: round(cfR - cfP), unit: "score" };
    if (pron.length) {
      progression.pronunciation = {
        before: round(avg(accHalf.prior)),
        after: round(avg(accHalf.recent)),
        delta: round(avg(accHalf.recent) - avg(accHalf.prior)),
        unit: "score",
      };
      progression.fluency = {
        before: round(avg(fluHalf.prior)),
        after: round(avg(fluHalf.recent)),
        delta: round(avg(fluHalf.recent) - avg(fluHalf.prior)),
        unit: "score",
      };
    }

    // Determine priority: worst absolute + stagnation signal
    type Sk = NonNullable<CoachReport["prioritySkill"]>;
    const candidates: { skill: Sk; badness: number }[] = [];
    if (progression.fillers) {
      // fillers: high value = bad; stagnation if delta >= 0
      const b = fillR + Math.max(0, fillR - fillP) * 2;
      candidates.push({ skill: "fillers", badness: b });
    }
    if (progression.pace) {
      const target = 145;
      const off = Math.abs(paceR - target);
      candidates.push({
        skill: "pace",
        badness: off + Math.max(0, off - Math.abs(paceP - target)),
      });
    }
    if (progression.pronunciation) {
      candidates.push({
        skill: "pronunciation",
        badness:
          100 -
          progression.pronunciation.after +
          Math.max(0, progression.pronunciation.before - progression.pronunciation.after),
      });
    }
    if (progression.fluency) {
      candidates.push({
        skill: "fluency",
        badness:
          100 -
          progression.fluency.after +
          Math.max(0, progression.fluency.before - progression.fluency.after),
      });
    }
    if (progression.clarity) {
      candidates.push({ skill: "clarity", badness: 100 - clR + Math.max(0, clP - clR) });
    }
    if (progression.confidence) {
      candidates.push({ skill: "confidence", badness: 100 - cfR + Math.max(0, cfP - cfR) });
    }
    candidates.sort((a, b) => b.badness - a.badness);
    const prioritySkill: Sk = candidates[0]?.skill ?? "confidence";

    // Strengths (biggest positive delta)
    const strengthEntries: { key: string; delta: number }[] = [];
    if (progression.clarity && progression.clarity.delta > 3)
      strengthEntries.push({ key: "clarity", delta: progression.clarity.delta });
    if (progression.confidence && progression.confidence.delta > 3)
      strengthEntries.push({ key: "confidence", delta: progression.confidence.delta });
    if (progression.pronunciation && progression.pronunciation.delta > 3)
      strengthEntries.push({ key: "pronunciation", delta: progression.pronunciation.delta });
    if (progression.fluency && progression.fluency.delta > 3)
      strengthEntries.push({ key: "fluency", delta: progression.fluency.delta });
    if (progression.fillers && progression.fillers.delta < -1)
      strengthEntries.push({ key: "fillers", delta: -progression.fillers.delta });
    if (progression.pace) {
      const before = Math.abs(paceP - 145);
      const after = Math.abs(paceR - 145);
      if (before - after > 5) strengthEntries.push({ key: "pace", delta: round(before - after) });
    }
    strengthEntries.sort((a, b) => b.delta - a.delta);

    // Build AI prompt
    const key = aiApiKey();
    const sys =
      data.lang === "fr"
        ? "Tu es le coach virtuel ALESIM: bienveillant, motivant, jamais moralisateur, orienté progrès. Tu tutoies. Réponds STRICTEMENT en JSON valide."
        : "You are the ALESIM virtual coach: warm, motivating, never preachy, progress-oriented. Reply STRICTLY as valid JSON.";
    const stats = {
      sampleSize,
      voice: voice.length,
      pronunciation: pron.length,
      lessons: comps?.length ?? 0,
      progression,
      prioritySkill,
      strengths: strengthEntries.slice(0, 2).map((s) => s.key),
      lessonWpmAvg: round(avg(lessonWpm)),
    };
    const user = `Voici les tendances de l'utilisateur sur les ${sampleSize} dernières sessions (moitié récente vs moitié précédente):\n${JSON.stringify(stats, null, 2)}\n\nRègles:\n- Un SEUL point prioritaire mis en avant (${prioritySkill}).\n- Reconnais un progrès concret même minime avant toute correction.\n- Propose EXACTEMENT 3 exercices actionnables ciblant la faiblesse principale, progressifs (court → plus long), adaptés à la stagnation vs progression rapide.\n- Chaque exercice a une "route" parmi: "today" (leçon quotidienne), "practice" (prononciation langues), "explore" (bibliothèque). Choisis la route la plus pertinente au focus.\n\nRéponds en JSON:\n{\n  "summary": "<résumé hebdo en 2 phrases, ${data.lang === "fr" ? "français" : "anglais"}>",\n  "progressNote": "<une phrase reconnaissant un progrès concret>",\n  "exercises": [\n    { "title": "...", "why": "...", "howto": "...", "durationMin": <2|3|5|10>, "focus": "fillers|pace|structure|tone|confidence|clarity|pronunciation|fluency", "route": "today|practice|explore" },\n    { ... }, { ... }\n  ],\n  "strengths": ["<point fort consolidé 1>", "<point fort 2>"]\n}\nAucun texte hors JSON, pas de markdown.`;

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
      throw new Error(`Coach AI failed: ${res.status} ${err}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: {
      summary?: string;
      progressNote?: string;
      exercises?: Array<Partial<CoachExercise>>;
      strengths?: string[];
    } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    const exercises: CoachExercise[] = (parsed.exercises ?? []).slice(0, 3).map((e) => ({
      title: e.title ?? "Exercice",
      why: e.why ?? "",
      howto: e.howto ?? "",
      durationMin:
        typeof e.durationMin === "number"
          ? Math.min(15, Math.max(1, Math.round(e.durationMin)))
          : 3,
      focus: (e.focus as CoachExercise["focus"]) ?? (prioritySkill as CoachExercise["focus"]),
      route:
        e.route === "practice" || e.route === "explore" || e.route === "today"
          ? e.route
          : prioritySkill === "pronunciation" || prioritySkill === "fluency"
            ? "practice"
            : "today",
      routeParams:
        prioritySkill === "fillers" || prioritySkill === "clarity"
          ? { focus: "confidence" }
          : prioritySkill === "pace"
            ? { focus: "pace" }
            : prioritySkill === "pronunciation" || prioritySkill === "fluency"
              ? undefined
              : { focus: "confidence" },
    }));

    const weekStart = isoMonday();
    const report: CoachReport = {
      weekStart,
      summary:
        parsed.summary ??
        (data.lang === "fr"
          ? "Continue sur cette lancée — chaque séance compte."
          : "Keep the momentum — every session counts."),
      progressNote: parsed.progressNote ?? "",
      prioritySkill,
      progression,
      metrics: {
        sampleSize,
        voiceSessions: voice.length,
        pronunciationSessions: pron.length,
        lessonsCompleted: comps?.length ?? 0,
        weekLabel: weekStart,
      },
      exercises,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 3) : [],
    };

    await supabase.from("weekly_coaching").upsert(
      {
        user_id: userId,
        week_start: weekStart,
        lang: data.lang,
        summary: report.summary,
        priority_skill: prioritySkill,
        progress_note: report.progressNote,
        metrics: report.metrics,
        progression: report.progression,
        exercises: report.exercises,
        sample_size: sampleSize,
      },
      { onConflict: "user_id,week_start" },
    );

    return report;
  });

export const getLatestCoachingReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CoachReport | null> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("weekly_coaching")
      .select("*")
      .eq("user_id", userId)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      weekStart: data.week_start as string,
      summary: data.summary,
      progressNote: data.progress_note ?? "",
      prioritySkill: data.priority_skill as CoachReport["prioritySkill"],
      progression: data.progression as CoachReport["progression"],
      metrics: data.metrics as CoachReport["metrics"],
      exercises: data.exercises as CoachExercise[],
      strengths: [],
    };
  });
