import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_lessons",
  title: "List lesson catalogue",
  description:
    "Browse the ALESIM lesson catalogue (title, theme, exercise prompt), optionally filtered by theme.",
  inputSchema: {
    theme: z.string().optional().describe("Filter on a lesson theme, e.g. confiance, débit, articulation."),
    limit: z.number().int().min(1).max(50).optional().describe("How many lessons to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ theme, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("lessons")
      .select("id, slug, theme, title_fr, title_en, exercise_prompt_fr, target_seconds, order_index")
      .order("order_index", { ascending: true })
      .limit(limit ?? 20);
    if (theme) query = query.eq("theme", theme);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { lessons: data ?? [] },
    };
  },
});