import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type UnlockedBadge = {
  code: string;
  icon: string;
  title_fr: string;
  title_en: string;
  desc_fr: string;
  desc_en: string;
};

/**
 * Check every badge condition for the given user and grant any that are met.
 * Returns the list of badges newly unlocked in this call.
 */
export async function checkAndUnlockBadgesFor(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<UnlockedBadge[]> {
  const [
    { data: badges },
    { data: alreadyRows },
    { data: streak },
    completionsRes,
    viewsRes,
    interviewRes,
  ] = await Promise.all([
    supabase.from("badges").select("*"),
    supabase.from("user_badges").select("badge_id").eq("user_id", userId),
    supabase.from("streaks").select("current_streak").eq("user_id", userId).maybeSingle(),
    supabase
      .from("lesson_completions")
      .select("lesson_id, quiz_score, quiz_total, lessons(theme)")
      .eq("user_id", userId),
    supabase.from("content_views").select("id").eq("user_id", userId),
    supabase
      .from("interview_responses")
      .select("structure_score, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const already = new Set((alreadyRows ?? []).map((r) => r.badge_id));
  const currentStreak = streak?.current_streak ?? 0;
  const completions = (completionsRes.data ?? []) as Array<{
    quiz_score: number | null;
    quiz_total: number | null;
    lessons: { theme: string } | { theme: string }[] | null;
  }>;
  const contentViewsCount = (viewsRes.data ?? []).length;
  const interviewRows = (interviewRes.data ?? []) as Array<{ structure_score: number | null }>;
  const interviewResponsesCount = interviewRows.length;
  // Longest run of well-structured answers (>= 70) among the most recent ones.
  let starStreak = 0;
  for (const r of interviewRows) {
    if ((r.structure_score ?? 0) >= 70) starStreak += 1;
    else break;
  }
  const lessonsCount = completions.length;
  const hasPerfectQuiz = completions.some(
    (c) => c.quiz_total && c.quiz_score !== null && c.quiz_score === c.quiz_total,
  );
  const themeCounts = new Map<string, number>();
  for (const c of completions) {
    const t = Array.isArray(c.lessons) ? c.lessons[0]?.theme : c.lessons?.theme;
    if (!t) continue;
    themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
  }

  const meetsCondition = (b: {
    condition_type: string;
    condition_value: number;
    condition_meta: string | null;
  }) => {
    switch (b.condition_type) {
      case "streak":
        return currentStreak >= b.condition_value;
      case "lessons_completed":
        return lessonsCount >= b.condition_value;
      case "content_views":
        return contentViewsCount >= b.condition_value;
      case "quiz_perfect":
        return hasPerfectQuiz;
      case "theme_completed":
        return (themeCounts.get(b.condition_meta ?? "") ?? 0) >= b.condition_value;
      case "interview_responses":
        return interviewResponsesCount >= b.condition_value;
      case "star_streak":
        return starStreak >= b.condition_value;
      default:
        return false;
    }
  };

  const toInsert: UnlockedBadge[] = [];
  const inserts: Array<{ user_id: string; badge_id: string }> = [];
  for (const b of badges ?? []) {
    if (already.has(b.id)) continue;
    if (!meetsCondition(b)) continue;
    inserts.push({ user_id: userId, badge_id: b.id });
    toInsert.push({
      code: b.code,
      icon: b.icon,
      title_fr: b.title_fr,
      title_en: b.title_en,
      desc_fr: b.desc_fr,
      desc_en: b.desc_en,
    });
  }
  if (inserts.length) {
    await supabase.from("user_badges").insert(inserts);
  }
  return toInsert;
}
