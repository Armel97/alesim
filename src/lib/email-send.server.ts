import { EmailAPIError, sendLovableEmail, type EmailSendRequest } from "@lovable.dev/email-js";

import { recordEmailEvent } from "@/lib/email-diagnostics.server";

export const SENDER_DOMAIN = "notify.alesimspeak.dev";
export const FROM_DOMAIN = "alesimspeak.dev";
export const DEFAULT_FROM = `ALESIM <noreply@${FROM_DOMAIN}>`;

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

export type SendResult =
  | { sent: true; messageId?: string; attempts: number }
  | { sent: false; reason: string; status?: number; attempts: number };

function backoffMs(attempt: number, retryAfterSeconds: number | null): number {
  if (retryAfterSeconds != null) return Math.min(retryAfterSeconds * 1_000, MAX_BACKOFF_MS);
  const exponential = Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
  // Jitter ±25 % pour éviter les rafales synchronisées.
  return Math.round(exponential * (0.75 + Math.random() * 0.5));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Envoi d'un e-mail applicatif avec réessais bornés et journalisation.
 *
 * - 429 : attend `retryAfterSeconds` (60 s par défaut) avant de réessayer.
 * - 5xx / erreurs réseau : backoff exponentiel avec jitter.
 * - `domain_not_verified`, `emails_disabled`, destinataire supprimé : pas de
 *   réessai (états côté plateforme), mais journalisés pour diagnostic.
 *
 * Ne jette jamais : le fallback est de retourner un résultat exploitable par
 * l'appelant (et une ligne dans le journal de diagnostic).
 */
export async function sendEmailWithRetry(
  payload: Omit<EmailSendRequest, "from"> & { from?: string },
  meta: { template?: string; idempotencyKey?: string } = {},
): Promise<SendResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    await recordEmailEvent({
      eventType: "send_failed",
      recipient: payload.to,
      template: meta.template,
      status: "missing_api_key",
    });
    return { sent: false, reason: "missing_api_key", attempts: 0 };
  }

  const request: EmailSendRequest = {
    ...payload,
    from: payload.from ?? DEFAULT_FROM,
    sender_domain: payload.sender_domain ?? SENDER_DOMAIN,
    idempotency_key: payload.idempotency_key ?? meta.idempotencyKey,
  };

  let lastReason = "unknown_error";
  let lastStatus: number | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await sendLovableEmail(request, {
        apiKey,
        sendUrl: process.env["LOVABLE_SEND_URL"],
        idempotencyKey: request.idempotency_key,
      });
      await recordEmailEvent({
        eventType: "sent",
        recipient: request.to,
        template: meta.template,
        messageId: response.message_id,
        status: response.status ?? "accepted",
        detail: { attempts: attempt },
      });
      return { sent: true, messageId: response.message_id, attempts: attempt };
    } catch (error) {
      const apiError = error instanceof EmailAPIError ? error : null;
      lastStatus = apiError?.status;
      lastReason = apiError?.code ?? (error instanceof Error ? error.message : "unknown_error");

      const suppressed = apiError?.code === "recipient_suppressed";
      const permanent =
        suppressed ||
        apiError?.code === "domain_not_verified" ||
        apiError?.code === "emails_disabled" ||
        (apiError != null && apiError.status >= 400 && apiError.status < 500 && apiError.status !== 429);

      if (suppressed) {
        await recordEmailEvent({
          eventType: "suppressed",
          recipient: request.to,
          template: meta.template,
          status: "recipient_suppressed",
          detail: { attempts: attempt },
        });
        return { sent: false, reason: "recipient_suppressed", status: apiError?.status, attempts: attempt };
      }

      const isLast = attempt === MAX_ATTEMPTS || permanent;
      await recordEmailEvent({
        eventType: isLast ? "send_failed" : apiError?.status === 429 ? "rate_limited" : "send_retry",
        recipient: request.to,
        template: meta.template,
        status: lastReason,
        detail: { attempt, status: lastStatus ?? null, retry_after: apiError?.retryAfterSeconds ?? null },
      });
      console.error("[email-send] attempt failed", {
        template: meta.template,
        attempt,
        status: lastStatus,
        code: lastReason,
      });

      if (isLast) break;
      await sleep(backoffMs(attempt, apiError?.status === 429 ? (apiError.retryAfterSeconds ?? 60) : null));
    }
  }

  return { sent: false, reason: lastReason, status: lastStatus, attempts: MAX_ATTEMPTS };
}
