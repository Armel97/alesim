import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listLessons = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const url = process.env.SUPABASE_URL!;
  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await supabase.from("lessons").select("*").order("order_index");
  if (error) throw new Error(error.message);
  return data ?? [];
});

const CompleteSchema = z.object({
  lessonId: z.string().uuid(),
  wpm: z.number().int().nonnegative().optional(),
  durationSec: z.number().int().nonnegative().optional(),
  transcript: z.string().optional(),
  feedback: z.string().optional(),
  quizScore: z.number().int().nonnegative().optional(),
  quizTotal: z.number().int().nonnegative().optional(),
});

export const completeLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => CompleteSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("lesson_completions").upsert(
      {
        user_id: userId,
        lesson_id: data.lessonId,
        wpm: data.wpm ?? null,
        duration_sec: data.durationSec ?? null,
        transcript: data.transcript ?? null,
        feedback: data.feedback ?? null,
        quiz_score: data.quizScore ?? null,
        quiz_total: data.quizTotal ?? null,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_id" },
    );
    if (error) throw new Error(error.message);

    // Update streak
    const today = new Date().toISOString().slice(0, 10);
    const { data: streak } = await supabase
      .from("streaks")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    let current = streak?.current_streak ?? 0;
    const longest = streak?.longest_streak ?? 0;
    const last = streak?.last_active_date;
    let graceLastUsed = streak?.grace_last_used ?? null;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const isSameISOWeek = (a: string, b: string) => {
      const wk = (d: Date) => {
        const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        const day = t.getUTCDay() || 7;
        t.setUTCDate(t.getUTCDate() + 4 - day);
        const yr = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
        const n = Math.ceil(((+t - +yr) / 86400000 + 1) / 7);
        return `${t.getUTCFullYear()}-${n}`;
      };
      return wk(new Date(a)) === wk(new Date(b));
    };
    if (last === today) {
      // already active today
    } else if (last === yesterday) {
      current = current + 1;
    } else if (last) {
      // Missed at least one day — try to use the weekly grace day
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
      const graceAvailable = !graceLastUsed || !isSameISOWeek(graceLastUsed, today);
      if (last === twoDaysAgo && graceAvailable) {
        current = current + 1;
        graceLastUsed = today;
      } else {
        current = 1;
      }
    } else {
      current = 1;
    }
    await supabase.from("streaks").upsert({
      user_id: userId,
      current_streak: current,
      longest_streak: Math.max(longest, current),
      last_active_date: today,
      grace_last_used: graceLastUsed,
    });

    // Progression alert: push on streak milestones (3, 7, 14, 30, 60, 100 days)
    const milestones = [3, 7, 14, 30, 60, 100];
    if (milestones.includes(current)) {
      try {
        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", userId);
        if (subs?.length) {
          const { sendPush } = await import("./push-sender.server");
          await Promise.all(
            subs.map((s) =>
              sendPush(s, {
                title: `🔥 ${current} jours d'affilée !`,
                body: "Bravo, votre régularité paie. Continuez demain pour prolonger la série.",
                url: "/today",
                tag: "alesim-streak",
              }),
            ),
          );
        }
      } catch (_) {
        // Non-blocking
      }
    }

    // Unlock any newly-earned badges
    let newBadges: Awaited<ReturnType<typeof import("./badges.server").checkAndUnlockBadgesFor>> =
      [];
    try {
      const { checkAndUnlockBadgesFor } = await import("./badges.server");
      newBadges = await checkAndUnlockBadgesFor(supabase, userId);
    } catch (_) {
      // Non-blocking
    }

    return { ok: true, currentStreak: current, newBadges };
  });

export const getMyCompletions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: completions }, { data: streak }] = await Promise.all([
      supabase.from("lesson_completions").select("lesson_id, completed_at").eq("user_id", userId),
      supabase.from("streaks").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    return { completions: completions ?? [], streak: streak ?? null };
  });

export type ThemeMastery = {
  theme: string;
  completions: number;
  avgQuizPct: number | null;
  mastery: number; // 0..1, higher = stronger
};

export const getMyThemeMastery = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ThemeMastery[]> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("lesson_completions")
      .select("quiz_score, quiz_total, lessons(theme)")
      .eq("user_id", userId);
    const rows = (data ?? []) as Array<{
      quiz_score: number | null;
      quiz_total: number | null;
      lessons: { theme: string } | { theme: string }[] | null;
    }>;
    const themes = ["breathing", "articulation", "confidence"];
    const agg = new Map<string, { n: number; pctSum: number; pctN: number }>();
    for (const th of themes) agg.set(th, { n: 0, pctSum: 0, pctN: 0 });
    for (const r of rows) {
      const lesson = Array.isArray(r.lessons) ? r.lessons[0] : r.lessons;
      const th = lesson?.theme;
      if (!th || !agg.has(th)) continue;
      const a = agg.get(th)!;
      a.n += 1;
      if (r.quiz_total && r.quiz_total > 0 && r.quiz_score !== null) {
        a.pctSum += r.quiz_score / r.quiz_total;
        a.pctN += 1;
      }
    }
    const maxN = Math.max(1, ...Array.from(agg.values()).map((a) => a.n));
    return themes.map((theme) => {
      const a = agg.get(theme)!;
      const avgQuizPct = a.pctN > 0 ? a.pctSum / a.pctN : null;
      // Mastery blends quiz accuracy (or a neutral 0.5 when untested) with practice volume.
      const quizPart = avgQuizPct ?? 0.5;
      const volumePart = a.n / maxN;
      const mastery = 0.65 * quizPart + 0.35 * volumePart;
      return { theme, completions: a.n, avgQuizPct, mastery };
    });
  });
