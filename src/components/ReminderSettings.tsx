import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, CalendarClock, Moon, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import {
  getReminderSettings,
  getVapidPublicKey,
  saveReminderSettings,
  savePushSubscription,
  deletePushSubscription,
  sendTestPush,
} from "@/lib/push.functions";

type Settings = {
  notifications_enabled: boolean;
  reminder_hour_utc: number;
  weekly_reminder_enabled: boolean;
  weekly_reminder_dow: number;
  weekly_reminder_hour_utc: number;
  quiet_start_hour_utc: number | null;
  quiet_end_hour_utc: number | null;
};

const DEFAULTS: Settings = {
  notifications_enabled: false,
  reminder_hour_utc: 17,
  weekly_reminder_enabled: true,
  weekly_reminder_dow: 1,
  weekly_reminder_hour_utc: 17,
  quiet_start_hour_utc: null,
  quiet_end_hour_utc: null,
};

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

export function ReminderSettings() {
  const { lang } = useLang();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [pushOn, setPushOn] = useState(false);
  const [supported, setSupported] = useState(true);

  const L =
    lang === "fr"
      ? {
          title: "Rappels de motivation",
          lead: "Recevez un rappel doux chaque jour et un récap' hebdo. Mode silencieux pour les heures calmes.",
          signIn: "Connectez-vous pour configurer vos rappels.",
          unsupported: "Votre navigateur ne prend pas en charge les notifications push.",
          enable: "Activer les notifications",
          disable: "Désactiver",
          test: "Tester l'envoi",
          daily: "Rappel quotidien",
          dailyHour: "Heure (UTC)",
          weekly: "Récap' hebdomadaire",
          weeklyDay: "Jour",
          weeklyHour: "Heure (UTC)",
          quiet: "Mode silencieux",
          quietHint: "Aucun rappel ne partira pendant cette plage horaire (UTC).",
          quietStart: "Début",
          quietEnd: "Fin",
          quietOff: "— désactivé —",
          save: "Enregistrer",
          saved: "Réglages enregistrés",
          days: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
        }
      : {
          title: "Motivation reminders",
          lead: "Get a gentle daily nudge and a weekly recap. Use quiet hours to protect your downtime.",
          signIn: "Sign in to configure your reminders.",
          unsupported: "Your browser does not support push notifications.",
          enable: "Enable notifications",
          disable: "Disable",
          test: "Send a test",
          daily: "Daily reminder",
          dailyHour: "Hour (UTC)",
          weekly: "Weekly recap",
          weeklyDay: "Day",
          weeklyHour: "Hour (UTC)",
          quiet: "Quiet hours",
          quietHint: "No reminder will be sent during this time range (UTC).",
          quietStart: "Start",
          quietEnd: "End",
          quietOff: "— off —",
          save: "Save",
          saved: "Settings saved",
          days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      const sup =
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      setSupported(sup);
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        setAuthed(false);
        setLoading(false);
        return;
      }
      setAuthed(true);
      try {
        const remote = await getReminderSettings();
        if (remote) {
          setS({
            notifications_enabled: !!remote.notifications_enabled,
            reminder_hour_utc: remote.reminder_hour_utc ?? 17,
            weekly_reminder_enabled: remote.weekly_reminder_enabled ?? true,
            weekly_reminder_dow: remote.weekly_reminder_dow ?? 1,
            weekly_reminder_hour_utc: remote.weekly_reminder_hour_utc ?? 17,
            quiet_start_hour_utc: remote.quiet_start_hour_utc ?? null,
            quiet_end_hour_utc: remote.quiet_end_hour_utc ?? null,
          });
        }
        if (sup) {
          const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
          const sub = await reg?.pushManager.getSubscription();
          setPushOn(!!sub);
        }
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enablePush() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
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
      setPushOn(true);
      toast.success(L.saved);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription({ data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setPushOn(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function persist(next: Settings) {
    setS(next);
    try {
      await saveReminderSettings({
        data: {
          reminderHourUtc: next.reminder_hour_utc,
          weeklyEnabled: next.weekly_reminder_enabled,
          weeklyDow: next.weekly_reminder_dow,
          weeklyHourUtc: next.weekly_reminder_hour_utc,
          quietStartHourUtc: next.quiet_start_hour_utc,
          quietEndHourUtc: next.quiet_end_hour_utc,
        },
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (loading) {
    return (
      <section className="rounded-3xl border bg-card p-6 text-sm text-muted-foreground">
        {L.title}…
      </section>
    );
  }
  if (!authed) {
    return (
      <section className="rounded-3xl border bg-card p-6">
        <h3 className="font-serif text-xl">{L.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{L.signIn}</p>
      </section>
    );
  }

  const quietOn = s.quiet_start_hour_utc !== null && s.quiet_end_hour_utc !== null;

  return (
    <section className="rounded-3xl border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl">{L.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{L.lead}</p>
        </div>
        <div className="rounded-full bg-secondary p-2">
          {pushOn ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4" />}
        </div>
      </div>

      {!supported ? (
        <p className="mt-4 text-xs text-destructive">{L.unsupported}</p>
      ) : !pushOn ? (
        <button
          onClick={enablePush}
          disabled={busy}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          <Bell className="h-4 w-4" /> {L.enable}
        </button>
      ) : (
        <div className="mt-5 space-y-6">
          <div className="rounded-2xl bg-secondary/40 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Bell className="h-3.5 w-3.5" />
              {L.daily}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="text-sm text-muted-foreground">{L.dailyHour}</label>
              <HourInput
                value={s.reminder_hour_utc}
                onChange={(h) => persist({ ...s, reminder_hour_utc: h })}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-secondary/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                {L.weekly}
              </div>
              <Switch
                checked={s.weekly_reminder_enabled}
                onChange={(v) => persist({ ...s, weekly_reminder_enabled: v })}
              />
            </div>
            {s.weekly_reminder_enabled && (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">{L.weeklyDay}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {L.days.map((d, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => persist({ ...s, weekly_reminder_dow: i })}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                          s.weekly_reminder_dow === i
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background hover:bg-secondary"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-sm text-muted-foreground">{L.weeklyHour}</label>
                  <HourInput
                    value={s.weekly_reminder_hour_utc}
                    onChange={(h) => persist({ ...s, weekly_reminder_hour_utc: h })}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-secondary/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <Moon className="h-3.5 w-3.5" />
                {L.quiet}
              </div>
              <Switch
                checked={quietOn}
                onChange={(v) =>
                  persist({
                    ...s,
                    quiet_start_hour_utc: v ? (s.quiet_start_hour_utc ?? 22) : null,
                    quiet_end_hour_utc: v ? (s.quiet_end_hour_utc ?? 8) : null,
                  })
                }
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{L.quietHint}</p>
            {quietOn && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="text-sm text-muted-foreground">{L.quietStart}</label>
                <HourInput
                  value={s.quiet_start_hour_utc ?? 22}
                  onChange={(h) => persist({ ...s, quiet_start_hour_utc: h })}
                />
                <label className="text-sm text-muted-foreground">{L.quietEnd}</label>
                <HourInput
                  value={s.quiet_end_hour_utc ?? 8}
                  onChange={(h) => persist({ ...s, quiet_end_hour_utc: h })}
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await sendTestPush();
                  if (r.ok) toast.success(L.saved);
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" /> {L.test}
            </button>
            <button
              onClick={disablePush}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs disabled:opacity-50"
            >
              <BellOff className="h-3.5 w-3.5" /> {L.disable}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function HourInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      max={23}
      value={value}
      onChange={(e) => onChange(Math.max(0, Math.min(23, Number(e.target.value) || 0)))}
      className="w-20 rounded-md border bg-background px-2 py-1 text-sm"
    />
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-border"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}
