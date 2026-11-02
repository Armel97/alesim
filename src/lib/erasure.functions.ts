import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Effacement des données (art. 17 RGPD).
 * - Trace analytics : supprimable par le visiteur lui-même via son identifiant anonyme local.
 * - Données vocales du compte : supprimables par l'utilisateur authentifié.
 */
export const eraseAnalyticsTrail = createServerFn({ method: "POST" })
  .inputValidator((input: { anonId: string }) => {
    const anonId = String(input?.anonId ?? "").trim();
    if (anonId.length < 8 || anonId.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(anonId)) {
      throw new Error("Identifiant analytics invalide");
    }
    return { anonId };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error, count } = await supabaseAdmin
      .from("funnel_events")
      .delete({ count: "exact" })
      .eq("anon_id", data.anonId);
    if (error) throw error;
    return { deleted: count ?? 0 };
  });

export const eraseMyVoiceData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    const counts: Record<string, number> = {};

    for (const table of [
      "video_sessions",
      "interview_responses",
      "interview_simulations",
      "cv_analyses",
      "weekly_coaching",
    ] as const) {
      const { error, count } = await supabaseAdmin
        .from(table)
        .delete({ count: "exact" })
        .eq("user_id", uid);
      if (error) throw error;
      counts[table] = count ?? 0;
    }

    // Les leçons validées restent (progression), mais les contenus vocaux sont effacés.
    const { error: lessonError, count: lessonCount } = await supabaseAdmin
      .from("lesson_completions")
      .update({ transcript: null, feedback: null }, { count: "exact" })
      .eq("user_id", uid);
    if (lessonError) throw lessonError;
    counts["lesson_completions"] = lessonCount ?? 0;

    const { error: funnelError, count: funnelCount } = await supabaseAdmin
      .from("funnel_events")
      .delete({ count: "exact" })
      .eq("user_id", uid);
    if (funnelError) throw funnelError;
    counts["funnel_events"] = funnelCount ?? 0;

    return { counts };
  });
