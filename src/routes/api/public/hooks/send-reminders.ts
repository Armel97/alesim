import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/send-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendPush } = await import("@/lib/push-sender.server");

        const now = new Date();
        const hour = now.getUTCHours();
        const todayIso = now.toISOString().slice(0, 10);

        const { data: profiles, error } = await supabaseAdmin
          .from("profiles")
          .select(
            "id, reminder_hour_utc, last_reminder_at, onboarding_completed, quiet_start_hour_utc, quiet_end_hour_utc",
          )
          .eq("notifications_enabled", true)
          .eq("reminder_hour_utc", hour);
        if (error) return json({ error: error.message }, 500);

        const targets = (profiles ?? []).filter((p) => {
          if (!p.onboarding_completed) return false;
          if (isInQuietHours(hour, p.quiet_start_hour_utc, p.quiet_end_hour_utc)) return false;
          if (!p.last_reminder_at) return true;
          return p.last_reminder_at.slice(0, 10) !== todayIso;
        });

        let sent = 0;
        for (const p of targets) {
          // Skip if user already did today's lesson
          const { data: done } = await supabaseAdmin
            .from("lesson_completions")
            .select("id")
            .eq("user_id", p.id)
            .gte("completed_at", `${todayIso}T00:00:00.000Z`)
            .limit(1);
          if (done && done.length > 0) continue;

          const { data: subs } = await supabaseAdmin
            .from("push_subscriptions")
            .select("endpoint, p256dh, auth")
            .eq("user_id", p.id);
          if (!subs?.length) continue;

          for (const s of subs) {
            const r = await sendPush(s, {
              title: "ALESIM",
              body: "Votre leçon du jour vous attend — 5 minutes suffisent.",
              url: "/today",
              tag: "alesim-daily",
            });
            if (r.ok) sent++;
            else if (r.gone)
              await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
          await supabaseAdmin
            .from("profiles")
            .update({ last_reminder_at: now.toISOString() })
            .eq("id", p.id);
        }
        return json({ ok: true, hour, targets: targets.length, sent });
      },
    },
  },
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isInQuietHours(hour: number, start: number | null, end: number | null): boolean {
  if (start === null || end === null) return false;
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  // wraps midnight
  return hour >= start || hour < end;
}
