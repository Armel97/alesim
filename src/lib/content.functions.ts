import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const url = process.env.SUPABASE_URL!;
  return createClient<Database>(url, key, {
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
}

export const listContent = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("content_library")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getContentBySlug = createServerFn({ method: "GET" })
  .inputValidator((v: unknown) => z.object({ slug: z.string().min(1) }).parse(v))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: row, error } = await supabase
      .from("content_library")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const recordContentView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ contentId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("content_views")
      .upsert(
        { user_id: userId, content_id: data.contentId },
        { onConflict: "user_id,content_id" },
      );
    const { checkAndUnlockBadgesFor } = await import("./badges.server");
    const newBadges = await checkAndUnlockBadgesFor(supabase, userId);
    return { ok: true, newBadges };
  });

export const getMyContentViews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("content_views")
      .select("content_id, viewed_at")
      .eq("user_id", context.userId);
    return data ?? [];
  });

export const getConfidenceStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("content_views")
      .select("viewed_at, content_id, content_library!inner(theme, level, duration_min)")
      .eq("user_id", context.userId)
      .in("content_library.theme", ["breathing", "articulation", "confidence"]);
    if (error) throw new Error(error.message);
    type ViewRow = {
      viewed_at: string;
      content_id: string;
      content_library: { theme: string; level: string; duration_min: number };
    };
    const rows = ((data ?? []) as unknown as ViewRow[]).map((r) => ({
      viewedAt: r.viewed_at as string,
      contentId: r.content_id as string,
      theme: r.content_library.theme as "breathing" | "articulation" | "confidence",
      level: r.content_library.level as "beginner" | "intermediate" | "advanced",
      durationMin: (r.content_library.duration_min as number) ?? 0,
    }));
    return rows;
  });
