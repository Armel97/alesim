import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_cv_analyses",
  title: "List résumé analyses",
  description:
    "List the signed-in user's résumé (CV) analyses with score, summary and improvement axes.",
  inputSchema: {
    limit: z.number().int().min(1).max(20).optional().describe("How many analyses to return (default 5)."),
    includeAxes: z.boolean().optional().describe("Include the detailed improvement axes (default false)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, includeAxes }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const columns = includeAxes
      ? "id, file_name, target_role, score, summary, tone_note, keywords, axes, created_at"
      : "id, file_name, target_role, score, summary, created_at";
    const { data, error } = await supabase
      .from("cv_analyses")
      .select(columns)
      .eq("user_id", ctx.getUserId()!)
      .order("created_at", { ascending: false })
      .limit(limit ?? 5);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { analyses: data ?? [] },
    };
  },
});