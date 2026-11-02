import type { Json } from "@/integrations/supabase/types";

// Journal de diagnostic des e-mails (serveur uniquement).
// Ce journal est une vue de confort pour l'admin : la suppression et les
// réessais de livraison restent gérés par la plateforme.

export type EmailEventType =
  | "sent"
  | "bounced"
  | "complained"
  | "unsubscribed"
  | "send_failed"
  | "send_retry"
  | "suppressed"
  | "rate_limited";

export type RecordEmailEventInput = {
  /** Identifiant de livraison du webhook, utilisé pour dédupliquer. */
  eventId?: string;
  eventType: EmailEventType;
  recipient?: string;
  messageId?: string;
  template?: string;
  /** Code / raison lisible (ex. `domain_not_verified`, `429`). */
  status?: string;
  detail?: Record<string, unknown>;
};

/**
 * Écrit une ligne de journal. Ne jette jamais : un échec d'écriture du journal
 * ne doit pas transformer un envoi réussi en erreur, ni provoquer un renvoi
 * infini du webhook.
 */
export async function recordEmailEvent(input: RecordEmailEventInput): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      event_id: input.eventId ?? null,
      event_type: input.eventType,
      recipient: input.recipient ?? null,
      message_id: input.messageId ?? null,
      template: input.template ?? null,
      status: input.status ?? null,
      detail: JSON.parse(JSON.stringify(input.detail ?? {})) as Json,
    };
    if (input.eventId) {
      await supabaseAdmin
        .from("email_delivery_events")
        .upsert(row, { onConflict: "event_id", ignoreDuplicates: true });
    } else {
      await supabaseAdmin.from("email_delivery_events").insert(row);
    }
  } catch (error) {
    console.error("[email-diagnostics] failed to record event", error);
  }
}
