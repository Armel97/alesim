import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_badges",
  title: "List unlocked badges",
  description: "List the badges the signed-in user has unlocked in ALESIM, most recent first.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("user_badges")
      .select("unlocked_at, badges(code, icon, title_fr, title_en, desc_fr, desc_en)")
      .eq("user_id", ctx.getUserId()!)
      .order("unlocked_at", { ascending: false });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { badges: data ?? [] },
    };
  },
});