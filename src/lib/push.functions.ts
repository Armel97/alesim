import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env.VAPID_PUBLIC_KEY ?? "" };
});

const SubSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().optional(),
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => SubSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" },
    );
    if (error) throw new Error(error.message);
    await supabase.from("profiles").update({ notifications_enabled: true }).eq("id", userId);
    return { ok: true };
  });

export const deletePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ endpoint: z.string().url() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", data.endpoint);
    const { count } = await supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (!count)
      await supabase.from("profiles").update({ notifications_enabled: false }).eq("id", userId);
    return { ok: true };
  });

const PrefsSchema = z.object({
  reminderHourUtc: z.number().int().min(0).max(23),
});

export const saveNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => PrefsSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ reminder_hour_utc: data.reminderHourUtc })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const HourOrNull = z.number().int().min(0).max(23).nullable();
const ReminderSettingsSchema = z.object({
  reminderHourUtc: z.number().int().min(0).max(23),
  weeklyEnabled: z.boolean(),
  weeklyDow: z.number().int().min(0).max(6),
  weeklyHourUtc: z.number().int().min(0).max(23),
  quietStartHourUtc: HourOrNull,
  quietEndHourUtc: HourOrNull,
});

export const getReminderSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "notifications_enabled, reminder_hour_utc, weekly_reminder_enabled, weekly_reminder_dow, weekly_reminder_hour_utc, quiet_start_hour_utc, quiet_end_hour_utc",
      )
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const saveReminderSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => ReminderSettingsSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        reminder_hour_utc: data.reminderHourUtc,
        weekly_reminder_enabled: data.weeklyEnabled,
        weekly_reminder_dow: data.weeklyDow,
        weekly_reminder_hour_utc: data.weeklyHourUtc,
        quiet_start_hour_utc: data.quietStartHourUtc,
        quiet_end_hour_utc: data.quietEndHourUtc,
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    if (!subs?.length) return { ok: false, reason: "no_subscription" as const };
    const { sendPush } = await import("./push-sender.server");
    const results = await Promise.all(
      subs.map((s) =>
        sendPush(s, {
          title: "ALESIM",
          body: "Notifications activées 🎉 Vous recevrez votre rappel quotidien ici.",
          url: "/today",
          tag: "alesim-test",
        }),
      ),
    );
    // Clean up gone endpoints
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (let i = 0; i < subs.length; i++) {
      if (!results[i].ok && results[i].gone) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", subs[i].endpoint);
      }
    }
    return { ok: results.some((r) => r.ok) };
  });
