import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ProfileSchema = z.object({
  goal: z.string().min(1),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  availability: z.enum(["5", "10", "20"]),
  baselineWpm: z.number().int().nonnegative().optional(),
  displayName: z.string().optional(),
});

export const saveOnboardingProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => ProfileSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      goal: data.goal,
      level: data.level,
      availability: data.availability,
      baseline_wpm: data.baselineWpm ?? null,
      display_name: data.displayName ?? null,
      onboarding_completed: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });
