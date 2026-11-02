// Server-only helper around web-push. Never import from client bundles.
import webpush from "web-push";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const sub = process.env.VAPID_SUBJECT || "mailto:notifications@alesim.app";
  if (!pub || !priv) throw new Error("VAPID keys are not configured");
  webpush.setVapidDetails(sub, pub, priv);
  configured = true;
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

export type StoredSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function sendPush(sub: StoredSubscription, payload: PushPayload) {
  ensureConfigured();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 },
    );
    return { ok: true as const };
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode;
    return { ok: false as const, status, gone: status === 404 || status === 410 };
  }
}
