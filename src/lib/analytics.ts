/**
 * Suivi analytics du funnel : landing -> resultat -> soft gate -> auth -> dashboard.
 *
 * RGPD : aucun evenement n'est envoye tant que la mesure d'audience n'a pas ete
 * acceptee dans la banniere cookies. Les evenements produits avant la decision
 * sont mis en file d'attente localement puis envoyes (ou effaces) selon le choix.
 * Aucune donnee personnelle : identifiant anonyme aleatoire, identifiant de
 * session, nom d'etape, langue et chemin de page.
 */
import { supabase } from "@/integrations/supabase/client";
import { CONSENT_EVENT, hasAnalyticsConsent } from "@/lib/cookie-consent";
import { currentDeviceContext } from "@/lib/device-segment";

export const FUNNEL_EVENTS = [
  "landing_view",
  "topic_select",
  "record_start",
  "record_complete",
  "result_view",
  "softgate_view",
  "softgate_cta_click",
  "softgate_dismiss",
  "tracking_gate_view",
  "auth_view",
  "auth_method_click",
  "signup_success",
  "signin_success",
  "dashboard_view",
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

/** Etapes ordonnees utilisees pour le calcul des taux de conversion. */
export const FUNNEL_STEPS: { event: FunnelEvent; label: { fr: string; en: string } }[] = [
  { event: "landing_view", label: { fr: "Visite landing", en: "Landing view" } },
  { event: "record_start", label: { fr: "Enregistrement lance", en: "Recording started" } },
  { event: "result_view", label: { fr: "Resultat affiche", en: "Result viewed" } },
  { event: "softgate_view", label: { fr: "Soft gate vue", en: "Soft gate shown" } },
  { event: "auth_view", label: { fr: "Ecran auth", en: "Auth screen" } },
  { event: "signup_success", label: { fr: "Compte cree", en: "Account created" } },
  { event: "dashboard_view", label: { fr: "Dashboard", en: "Dashboard" } },
];

const ANON_KEY = "alesim.analytics.anonId";
const SESSION_KEY = "alesim.analytics.sessionId";
const QUEUE_KEY = "alesim.analytics.queue";

type QueuedEvent = {
  anon_id: string;
  session_id: string;
  event: string;
  step: string | null;
  path: string | null;
  lang: string | null;
  props: Record<string, unknown>;
  occurred_at: string;
};

function randomId() {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeStorage(kind: "local" | "session"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readId(store: Storage | null, key: string): string {
  if (!store) return randomId();
  const existing = store.getItem(key);
  if (existing && existing.length >= 8) return existing;
  const next = randomId();
  try {
    store.setItem(key, next);
  } catch {
    /* stockage indisponible */
  }
  return next;
}

export function anonId() {
  return readId(safeStorage("local"), ANON_KEY);
}

export function sessionId() {
  return readId(safeStorage("session"), SESSION_KEY);
}

function readQueue(): QueuedEvent[] {
  const raw = safeStorage("local")?.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedEvent[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedEvent[]) {
  try {
    safeStorage("local")?.setItem(QUEUE_KEY, JSON.stringify(items.slice(-50)));
  } catch {
    /* quota */
  }
}

export function clearAnalyticsQueue() {
  try {
    safeStorage("local")?.removeItem(QUEUE_KEY);
  } catch {
    /* noop */
  }
}

async function send(rows: QueuedEvent[]) {
  if (!rows.length) return;
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id ?? null;
  const { error } = await supabase.from("funnel_events").insert(
    rows.map((r) => ({
      ...r,
      props: r.props as never,
      user_id: userId,
    })),
  );
  if (error) throw error;
}

/** Enregistre un evenement du funnel (silencieux en cas d'echec reseau). */
export function track(
  event: FunnelEvent,
  props: Record<string, unknown> = {},
  options: { step?: string } = {},
) {
  if (typeof window === "undefined") return;
  const { device, form_factor } = currentDeviceContext();
  const row: QueuedEvent = {
    anon_id: anonId(),
    session_id: sessionId(),
    event,
    step: options.step ?? null,
    path: window.location.pathname,
    lang: document.documentElement.lang || null,
    props: { device, form_factor, ...props },
    occurred_at: new Date().toISOString(),
  };

  if (!hasAnalyticsConsent()) {
    writeQueue([...readQueue(), row]);
    return;
  }

  void send([row]).catch(() => {
    /* mesure best-effort : on n'interrompt jamais le parcours utilisateur */
  });
}

/** Vide la file d'attente : envoi si consentement, suppression sinon. */
export function flushAnalyticsQueue() {
  const queued = readQueue();
  if (!hasAnalyticsConsent()) {
    clearAnalyticsQueue();
    return;
  }
  if (!queued.length) return;
  clearAnalyticsQueue();
  void send(queued).catch(() => {
    /* best-effort */
  });
}

let listening = false;
/** A appeler une fois au demarrage de l'app cote client. */
export function initAnalytics() {
  if (typeof window === "undefined" || listening) return;
  listening = true;
  flushAnalyticsQueue();
  window.addEventListener(CONSENT_EVENT, () => flushAnalyticsQueue());

  // Retour de redirection OAuth : la page /auth n'est plus montee, on capte la connexion ici.
  supabase.auth.onAuthStateChange((event) => {
    if (event !== "SIGNED_IN") return;
    const store = safeStorage("session");
    if (store?.getItem("alesim.analytics.signedInTracked")) return;
    try {
      store?.setItem("alesim.analytics.signedInTracked", "1");
    } catch {
      /* noop */
    }
    track("signin_success", { method: "session" });
  });
}
