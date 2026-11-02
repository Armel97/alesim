import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyThemePrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("theme_prefs, theme_prefs_updated")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return {
      prefs: (data?.theme_prefs ?? {}) as Record<string, "priority" | "neutral" | "avoid">,
      ts: (data?.theme_prefs_updated ?? {}) as Record<string, string>,
    };
  });

/**
 * Conflict-safe write: server merges the client payload with what's stored
 * using per-theme last-write-wins on `ts`, then persists the merged result
 * and returns it so the client can adopt the reconciled state.
 */
export const setMyThemePrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      prefs: Record<string, "priority" | "neutral" | "avoid">;
      ts: Record<string, string>;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { data: row, error: readErr } = await context.supabase
      .from("profiles")
      .select("theme_prefs, theme_prefs_updated")
      .eq("id", context.userId)
      .maybeSingle();
    if (readErr) throw readErr;

    const remotePrefs = (row?.theme_prefs ?? {}) as Record<
      string,
      "priority" | "neutral" | "avoid"
    >;
    const remoteTs = (row?.theme_prefs_updated ?? {}) as Record<string, string>;

    const keys = new Set([...Object.keys(data.prefs), ...Object.keys(remotePrefs)]);
    const mergedPrefs: Record<string, "priority" | "neutral" | "avoid"> = {};
    const mergedTs: Record<string, string> = {};
    for (const k of keys) {
      const tLocal = Date.parse(data.ts[k] ?? "") || 0;
      const tRemote = Date.parse(remoteTs[k] ?? "") || 0;
      if (tLocal >= tRemote) {
        if (data.prefs[k]) mergedPrefs[k] = data.prefs[k];
        if (data.ts[k]) mergedTs[k] = data.ts[k];
      } else {
        if (remotePrefs[k]) mergedPrefs[k] = remotePrefs[k];
        if (remoteTs[k]) mergedTs[k] = remoteTs[k];
      }
    }

    const { error } = await context.supabase
      .from("profiles")
      .update({ theme_prefs: mergedPrefs, theme_prefs_updated: mergedTs })
      .eq("id", context.userId);
    if (error) throw error;
    return { prefs: mergedPrefs, ts: mergedTs };
  });
