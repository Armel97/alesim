import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EmailDiagnosticsRow = {
  source: "platform" | "app";
  occurredAt: string;
  eventType: string;
  status: string | null;
  recipient: string | null;
  messageId: string | null;
  template: string | null;
};

export type EmailDiagnostics = {
  rows: EmailDiagnosticsRow[];
  counts: Record<string, number>;
  historyStartsAt: string | null;
  platformError: string | null;
};

export const getEmailDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ days: z.number().int().min(1).max(90).optional() })
      .optional()
      .parse(input) ?? {},
  )
  .handler(async ({ data, context }): Promise<EmailDiagnostics> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw roleError;
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    const days = data?.days ?? 14;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    const { data: local, error } = await supabaseAdmin
      .from("email_delivery_events")
      .select("event_type, status, recipient, message_id, template, occurred_at")
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    const rows: EmailDiagnosticsRow[] = (local ?? []).map((r) => ({
      source: "app" as const,
      occurredAt: r.occurred_at,
      eventType: r.event_type,
      status: r.status,
      recipient: r.recipient,
      messageId: r.message_id,
      template: r.template,
    }));

    let historyStartsAt: string | null = null;
    let platformError: string | null = null;
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (apiKey) {
      try {
        const { listEmailLogs } = await import("@lovable.dev/email-js");
        const logs = await listEmailLogs({ since, limit: 100 }, { apiKey });
        historyStartsAt = logs.history_starts_at ?? null;
        for (const e of logs.data) {
          rows.push({
            source: "platform",
            occurredAt: e.timestamp,
            eventType: e.event_type,
            status: e.status ?? null,
            recipient: e.recipient ?? null,
            messageId: e.message_id ?? null,
            template: null,
          });
        }
      } catch (err) {
        platformError = err instanceof Error ? err.message : "unknown_error";
      }
    } else {
      platformError = "missing_api_key";
    }

    rows.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.eventType] = (counts[r.eventType] ?? 0) + 1;

    return { rows: rows.slice(0, 250), counts, historyStartsAt, platformError };
  });
