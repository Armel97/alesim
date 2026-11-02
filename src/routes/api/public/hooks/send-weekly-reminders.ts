import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/send-weekly-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendPush } = await import("@/lib/push-sender.server");

        const now = new Date();
        const hour = now.getUTCHours();
        const dow = now.getUTCDay(); // 0=Sun..6=Sat

        const { data: profiles, error } = await supabaseAdmin
          .from("profiles")
          .select(
            "id, weekly_reminder_hour_utc, weekly_reminder_dow, last_weekly_reminder_at, onboarding_completed, quiet_start_hour_utc, quiet_end_hour_utc",
          )
          .eq("notifications_enabled", true)
          .eq("weekly_reminder_enabled", true)
          .eq("weekly_reminder_dow", dow)
          .eq("weekly_reminder_hour_utc", hour);
        if (error) return json({ error: error.message }, 500);

        const sixDaysAgo = Date.now() - 6 * 86400000;
        const targets = (profiles ?? []).filter((p) => {
          if (!p.onboarding_completed) return false;
          if (isInQuietHours(hour, p.quiet_start_hour_utc, p.quiet_end_hour_utc)) return false;
          if (!p.last_weekly_reminder_at) return true;
          return new Date(p.last_weekly_reminder_at).getTime() < sixDaysAgo;
        });

        let sent = 0;
        for (const p of targets) {
          const weekStart = new Date(Date.now() - 7 * 86400000).toISOString();
          const { count } = await supabaseAdmin
            .from("lesson_completions")
            .select("id", { count: "exact", head: true })
            .eq("user_id", p.id)
            .gte("completed_at", weekStart);
          const n = count ?? 0;
          const body =
            n === 0
              ? "Une nouvelle semaine commence — 5 minutes suffisent pour reprendre l'élan."
              : `Belle semaine : ${n} leçon${n > 1 ? "s" : ""} terminée${n > 1 ? "s" : ""}. Continuez sur cette lancée !`;

          const { data: subs } = await supabaseAdmin
            .from("push_subscriptions")
            .select("endpoint, p256dh, auth")
            .eq("user_id", p.id);
          if (!subs?.length) continue;

          for (const s of subs) {
            const r = await sendPush(s, {
              title: "ALESIM — Récap' de la semaine",
              body,
              url: "/dashboard",
              tag: "alesim-weekly",
            });
            if (r.ok) sent++;
            else if (r.gone)
              await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
          await supabaseAdmin
            .from("profiles")
            .update({ last_weekly_reminder_at: now.toISOString() })
            .eq("id", p.id);
        }
        return json({ ok: true, hour, dow, targets: targets.length, sent });
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
  return hour >= start || hour < end;
}
