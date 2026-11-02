import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isDeviceSegment, isFormFactor } from "@/lib/device-segment";

/** Entonnoir d'un segment : uniques par etape + plus forte chute. */
export type SegmentFunnel = {
  key: string;
  visitors: number;
  uniques: Record<string, number>;
};

export type FunnelStats = {
  from: string;
  to: string;
  totalEvents: number;
  /** Visiteurs uniques (anon_id) ayant declenche chaque evenement. */
  uniques: Record<string, number>;
  /** Nombre brut d'occurrences par evenement. */
  counts: Record<string, number>;
  /** Serie journaliere des etapes cles. */
  daily: { date: string; landing: number; result: number; auth: number; signup: number }[];
  /** Repartition des sujets choisis sur la landing. */
  topics: { topic: string; count: number }[];
  /** Methodes d'authentification cliquees. */
  methods: { method: string; count: number }[];
  /** Entonnoir segmente par systeme (ios / android / desktop / other / unknown). */
  devices: SegmentFunnel[];
  /** Entonnoir segmente par format (mobile / tablet / desktop / unknown). */
  formFactors: SegmentFunnel[];
};

export const getFunnelStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days?: number } | undefined) => ({
    days: Math.min(Math.max(Number(input?.days ?? 30), 1), 365),
  }))
  .handler(async ({ data, context }): Promise<FunnelStats> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw roleError;
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    const from = new Date(Date.now() - data.days * 86400_000);
    const { data: rows, error } = await supabaseAdmin
      .from("funnel_events")
      .select("anon_id, event, props, occurred_at")
      .gte("occurred_at", from.toISOString())
      .order("occurred_at", { ascending: true })
      .limit(50000);
    if (error) throw error;

    const counts: Record<string, number> = {};
    const uniqueSets: Record<string, Set<string>> = {};
    const dailyMap = new Map<
      string,
      { landing: number; result: number; auth: number; signup: number }
    >();
    const topicMap = new Map<string, number>();
    const methodMap = new Map<string, number>();
    // Un visiteur = un segment : on retient la premiere valeur connue.
    const deviceByAnon = new Map<string, string>();
    const formByAnon = new Map<string, string>();
    type Row = { anon_id: string; event: string };
    const eventRows: Row[] = [];

    for (const row of rows ?? []) {
      const event = row.event;
      counts[event] = (counts[event] ?? 0) + 1;
      (uniqueSets[event] ??= new Set()).add(row.anon_id);

      const day = String(row.occurred_at).slice(0, 10);
      const bucket = dailyMap.get(day) ?? { landing: 0, result: 0, auth: 0, signup: 0 };
      if (event === "landing_view") bucket.landing += 1;
      if (event === "result_view") bucket.result += 1;
      if (event === "auth_view") bucket.auth += 1;
      if (event === "signup_success") bucket.signup += 1;
      dailyMap.set(day, bucket);

      const props = (row.props ?? {}) as Record<string, unknown>;
      if (!deviceByAnon.has(row.anon_id) && isDeviceSegment(props["device"])) {
        deviceByAnon.set(row.anon_id, props["device"]);
      }
      if (!formByAnon.has(row.anon_id) && isFormFactor(props["form_factor"])) {
        formByAnon.set(row.anon_id, props["form_factor"]);
      }
      eventRows.push({ anon_id: row.anon_id, event });
      if (event === "topic_select" && typeof props["topic"] === "string") {
        const topic = props["topic"].slice(0, 80);
        topicMap.set(topic, (topicMap.get(topic) ?? 0) + 1);
      }
      if (event === "auth_method_click" && typeof props["method"] === "string") {
        const method = props["method"].slice(0, 40);
        methodMap.set(method, (methodMap.get(method) ?? 0) + 1);
      }
    }

    const uniques: Record<string, number> = {};
    for (const [event, set] of Object.entries(uniqueSets)) uniques[event] = set.size;

    const buildSegments = (assign: Map<string, string>, order: string[]): SegmentFunnel[] => {
      const perSegment = new Map<
        string,
        { visitors: Set<string>; events: Map<string, Set<string>> }
      >();
      for (const row of eventRows) {
        const key = assign.get(row.anon_id) ?? "unknown";
        const entry = perSegment.get(key) ?? {
          visitors: new Set<string>(),
          events: new Map<string, Set<string>>(),
        };
        entry.visitors.add(row.anon_id);
        const set = entry.events.get(row.event) ?? new Set<string>();
        set.add(row.anon_id);
        entry.events.set(row.event, set);
        perSegment.set(key, entry);
      }
      return [...perSegment.entries()]
        .map(([key, entry]) => ({
          key,
          visitors: entry.visitors.size,
          uniques: Object.fromEntries([...entry.events].map(([e, s]) => [e, s.size])),
        }))
        .sort((a, b) => {
          const ia = order.indexOf(a.key);
          const ib = order.indexOf(b.key);
          if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
          return b.visitors - a.visitors;
        });
    };

    return {
      from: from.toISOString(),
      to: new Date().toISOString(),
      totalEvents: rows?.length ?? 0,
      counts,
      uniques,
      daily: [...dailyMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, v]) => ({ date, ...v })),
      topics: [...topicMap.entries()]
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      methods: [...methodMap.entries()]
        .map(([method, count]) => ({ method, count }))
        .sort((a, b) => b.count - a.count),
      devices: buildSegments(deviceByAnon, ["ios", "android", "desktop", "other", "unknown"]),
      formFactors: buildSegments(formByAnon, ["mobile", "tablet", "desktop", "unknown"]),
    };
  });

/** Indique si l'utilisateur connecte peut consulter les statistiques du funnel. */
export const amIAnalyticsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw error;
    return { admin: data === true };
  });
