import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_progress",
  title: "Get speaking progress",
  description:
    "Get the signed-in user's ALESIM profile (goal, level, language) and streak, plus counts of completed lessons.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const [profile, streak, completions] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, goal, level, ui_lang, baseline_wpm, onboarding_completed")
        .eq("id", userId!)
        .maybeSingle(),
      supabase
        .from("streaks")
        .select("current_streak, longest_streak, last_active_date")
        .eq("user_id", userId!)
        .maybeSingle(),
      supabase
        .from("lesson_completions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!),
    ]);
    const error = profile.error ?? streak.error ?? completions.error;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const payload = {
      profile: profile.data ?? null,
      streak: streak.data ?? null,
      lessonsCompleted: completions.count ?? 0,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});