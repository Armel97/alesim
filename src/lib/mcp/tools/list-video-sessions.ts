import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_video_sessions",
  title: "List video coaching sessions",
  description:
    "List the signed-in user's on-camera sessions with eye-contact percentage, posture metrics and coach suggestions.",
  inputSchema: {
    limit: z.number().int().min(1).max(20).optional().describe("How many sessions to return (default 5)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("video_sessions")
      .select(
        "id, created_at, duration_sec, gaze_camera_pct, posture_metrics, hesitation_metrics, summary, suggestions, prompt",
      )
      .eq("user_id", ctx.getUserId()!)
      .order("created_at", { ascending: false })
      .limit(limit ?? 5);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { sessions: data ?? [] },
    };
  },
});