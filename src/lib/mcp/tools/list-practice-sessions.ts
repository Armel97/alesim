import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_practice_sessions",
  title: "List practice sessions",
  description:
    "List the signed-in user's most recent completed speaking lessons with pace (wpm), duration, quiz score and coach feedback.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("How many sessions to return (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("lesson_completions")
      .select("id, lesson_id, completed_at, duration_sec, wpm, quiz_score, quiz_total, feedback")
      .eq("user_id", ctx.getUserId()!)
      .order("completed_at", { ascending: false })
      .limit(limit ?? 10);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { sessions: data ?? [] },
    };
  },
});