import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Send } from "lucide-react";
import { useLang } from "@/lib/i18n";
import {
  getVapidPublicKey,
  savePushSubscription,
  deletePushSubscription,
  saveNotificationPrefs,
  sendTestPush,
} from "@/lib/push.functions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function arrBufToB64Url(buf: ArrayBuffer | null) {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

type Status = "unsupported" | "denied" | "off" | "on" | "loading";

export function PushToggle({ initialHourUtc = 17 }: { initialHourUtc?: number }) {
  const { t } = useLang();
  const [status, setStatus] = useState<Status>("loading");
  const [hour, setHour] = useState(initialHourUtc);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    (async () => {
      const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
      const sub = await reg?.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    })();
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw-push.js");
      await navigator.serviceWorker.ready;
      const { publicKey } = await getVapidPublicKey();
      if (!publicKey) throw new Error("Missing VAPID key");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const raw = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const p256dh = raw.keys?.p256dh ?? arrBufToB64Url(sub.getKey("p256dh"));
      const auth = raw.keys?.auth ?? arrBufToB64Url(sub.getKey("auth"));
      await savePushSubscription({
        data: {
          endpoint: raw.endpoint ?? sub.endpoint,
          p256dh,
          auth,
          userAgent: navigator.userAgent,
        },
      });
      setStatus("on");
      toast.success(t.notifOn);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription({ data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setStatus("off");
      toast.success(t.notifOff);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveHour(h: number) {
    setHour(h);
    try {
      await saveNotificationPrefs({ data: { reminderHourUtc: h } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const r = await sendTestPush();
      if (r.ok) toast.success(t.testSent);
      else toast.error(t.testFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-secondary p-2">
          {status === "on" ? (
            <Bell className="h-4 w-4 text-primary" />
          ) : (
            <BellOff className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1">
          <p className="font-medium">{t.notifTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t.notifLead}</p>
          {status === "unsupported" && (
            <p className="mt-3 text-xs text-destructive">{t.notifUnsupported}</p>
          )}
          {status === "denied" && <p className="mt-3 text-xs text-destructive">{t.notifBlocked}</p>}
          {(status === "off" || status === "loading") && (
            <button
              onClick={enable}
              disabled={busy || status === "loading"}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              <Bell className="h-4 w-4" /> {t.notifEnable}
            </button>
          )}
          {status === "on" && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <label className="text-muted-foreground">{t.reminderHour}</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={hour}
                  onChange={(e) => saveHour(Math.max(0, Math.min(23, Number(e.target.value) || 0)))}
                  className="w-16 rounded-md border bg-background px-2 py-1"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={test}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" /> {t.sendTest}
                </button>
                <button
                  onClick={disable}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  <BellOff className="h-3.5 w-3.5" /> {t.notifDisable}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
