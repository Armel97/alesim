import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/i18n";
import { AuthedNav } from "@/components/AuthedNav";
import { listContent } from "@/lib/content.functions";
import { getMyProfile } from "@/lib/onboarding.functions";
import { getMyThemeMastery, type ThemeMastery } from "@/lib/lessons.functions";
import { getMyContentViews } from "@/lib/content.functions";
import { Search, Clock } from "lucide-react";
import { setQueue } from "@/lib/reinforce-queue";
import { Sparkles } from "lucide-react";
import {
  getThemePrefs,
  setThemePrefs,
  getThemePrefsTs,
  setThemePrefsTs,
  mergePrefs,
  type ThemePref,
  type ThemePrefs,
  type ThemePrefsTs,
} from "@/lib/theme-prefs";
import { getMyThemePrefs } from "@/lib/theme-prefs.functions";
import { installAutoSync, queueSync, onSyncApplied } from "@/lib/theme-prefs-sync";

export const Route = createFileRoute("/_authenticated/explore")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "ALESIM — Explorer" },
      {
        name: "description",
        content: "Bibliothèque de contenus ALESIM : respiration, articulation, confiance.",
      },
      { property: "og:title", content: "ALESIM — Explorer" },
      {
        property: "og:description",
        content: "Bibliothèque de contenus ALESIM : respiration, articulation, confiance.",
      },
    ],
  }),
  component: ExplorePage,
});

type Content = {
  id: string;
  slug: string;
  theme: string;
  level: string;
  duration_min: number;
  tags: string[];
  title_fr: string;
  title_en: string;
};

const THEMES = ["breathing", "articulation", "confidence"] as const;
const LEVELS = ["beginner", "intermediate", "advanced"] as const;

function ExplorePage() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [items, setItems] = useState<Content[]>([]);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<string>("all");
  const [level, setLevel] = useState<string>("all");
  const [dur, setDur] = useState<string>("any");
  const [userGoal, setUserGoal] = useState<string | null>(null);
  const [userLevel, setUserLevel] = useState<string | null>(null);
  const [mastery, setMastery] = useState<ThemeMastery[]>([]);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [themePrefs, setThemePrefsState] = useState<ThemePrefs>({});

  useEffect(() => {
    (async () => {
      const [rows, profile, m, views] = await Promise.all([
        listContent(),
        getMyProfile(),
        getMyThemeMastery(),
        getMyContentViews(),
      ]);
      setItems(rows as Content[]);
      setUserGoal(profile?.goal ?? null);
      setUserLevel(profile?.level ?? null);
      setMastery(m);
      setViewedIds(new Set(views.map((v) => v.content_id)));
    })();
    const local = getThemePrefs();
    const localTs = getThemePrefsTs();
    setThemePrefsState(local);
    getMyThemePrefs()
      .then((remote) => {
        // Per-theme last-write-wins merge of the two device states.
        const merged = mergePrefs(local, localTs, remote.prefs, remote.ts);
        setThemePrefsState(merged.prefs);
        setThemePrefs(merged.prefs);
        setThemePrefsTs(merged.ts);
        // Push the reconciled state back so the server converges too.
        // queueSync marks it pending and will retry automatically if offline.
        queueSync(merged.prefs, merged.ts);
      })
      .catch(() => {
        // Offline: keep local state and let auto-sync catch up later.
        if (Object.keys(local).length > 0) queueSync(local, localTs);
      });
    const unsubscribe = onSyncApplied((prefs) => setThemePrefsState(prefs));
    const uninstall = installAutoSync();
    return () => {
      unsubscribe();
      uninstall();
    };
  }, []);

  const themeLabel = (th: string) =>
    th === "breathing"
      ? t.themeBreathing
      : th === "articulation"
        ? t.themeArticulation
        : th === "confidence"
          ? t.themeConfidence
          : t.themeCommunication;
  const levelLabel = (lv: string) =>
    lv === "beginner"
      ? t.levelBeginner
      : lv === "intermediate"
        ? t.levelIntermediate
        : t.levelAdvanced;

  const goalTheme =
    userGoal === "public" || userGoal === "interview"
      ? "confidence"
      : userGoal === "stutter"
        ? "breathing"
        : userGoal === "articulate"
          ? "articulation"
          : null;

  const recommended = useMemo(() => {
    if (!items.length) return [] as Array<Content & { _reasons: string[] }>;
    const levelOrder = ["beginner", "intermediate", "advanced"];
    const userLvlIdx = Math.max(0, levelOrder.indexOf(userLevel ?? "beginner"));
    const preferred = levelOrder[Math.min(userLvlIdx + 1, 2)];

    // Weakness score per theme (lower mastery => higher weakness).
    const weakness = new Map<string, number>();
    for (const m of mastery) weakness.set(m.theme, 1 - m.mastery);
    const masteryByTheme = new Map(mastery.map((m) => [m.theme, m]));
    // If we have no signal at all, fall back to onboarding goal theme.
    const hasSignal = mastery.some((m) => m.completions > 0);

    const themePriority = (th: string) => {
      if (hasSignal) return weakness.get(th) ?? 0.5;
      if (goalTheme && th === goalTheme) return 1;
      return 0.4;
    };

    const scored = items.map((c) => {
      const already = viewedIds.has(c.id);
      const themeScore = themePriority(c.theme);
      const levelBonus = c.level === preferred ? 0.15 : c.level === userLevel ? 0.05 : 0;
      const freshBonus = already ? -0.4 : 0.1;
      const shortBonus = c.duration_min <= 5 ? 0.05 : 0;
      const score = themeScore + levelBonus + freshBonus + shortBonus;

      const reasons: string[] = [];
      const themeName = themeLabel(c.theme);
      const m = masteryByTheme.get(c.theme);
      if (hasSignal && m && (weakness.get(c.theme) ?? 0) >= 0.45) {
        reasons.push(`${t.reasonWeakTheme} : ${themeName}`);
      }
      if (m && m.avgQuizPct !== null && m.avgQuizPct < 0.75) {
        reasons.push(`${t.reasonLowQuiz} ${Math.round(m.avgQuizPct * 100)}% — ${themeName}`);
      }
      if (!hasSignal && goalTheme && c.theme === goalTheme) {
        reasons.push(t.reasonAlignsGoal);
      }
      if (c.level === preferred || c.level === userLevel) {
        reasons.push(`${t.reasonLevelFit} (${levelLabel(c.level)})`);
      }
      reasons.push(already ? t.reasonAlreadyRead : t.reasonUnread);
      if (c.duration_min <= 4) reasons.push(t.reasonShort);

      return { ...c, _score: score, _reasons: reasons };
    });

    return scored
      .sort((a, b) => b._score - a._score)
      .slice(0, 4)
      .map(({ _score, ...rest }) => rest);
  }, [items, mastery, viewedIds, userLevel, goalTheme, t, lang]);

  const levelOrder = ["beginner", "intermediate", "advanced"];
  const preferredLevel = (() => {
    const idx = Math.max(0, levelOrder.indexOf(userLevel ?? "beginner"));
    return levelOrder[Math.min(idx + 1, 2)];
  })();

  const [pickingTheme, setPickingTheme] = useState<string | null>(null);

  const buildQueue = (
    theme: string,
    targetMin: number,
    opts: {
      maxItems?: number;
      skipRead?: boolean;
      prioritizeWeak?: boolean;
      weakIntensity?: number;
    } = {},
  ) => {
    const { maxItems, skipRead, prioritizeWeak, weakIntensity = 1 } = opts;
    // Pool: single theme by default; all themes when prioritizing weak ones.
    let pool = prioritizeWeak ? items : items.filter((c) => c.theme === theme);
    if (skipRead) pool = pool.filter((c) => !viewedIds.has(c.id));
    // Respect per-theme avoid preference, but fall back to including them if
    // dropping them would leave no pool at all.
    const avoided = new Set(
      Object.entries(themePrefs)
        .filter(([, v]) => v === "avoid")
        .map(([k]) => k),
    );
    const filteredPool = pool.filter((c) => !avoided.has(c.theme));
    const usedFallback = filteredPool.length === 0 && pool.length > 0;
    if (!usedFallback) pool = filteredPool;
    if (!pool.length) return;

    const prefIdx = levelOrder.indexOf(preferredLevel);
    const MASTERY_GOAL = 0.6;
    const masteryByTheme = new Map(mastery.map((m) => [m.theme, m.mastery]));
    const scored = pool.map((c) => {
      const unread = viewedIds.has(c.id) ? 0 : 2;
      const distToPreferred = Math.abs(levelOrder.indexOf(c.level) - prefIdx);
      const levelFit = Math.max(0, 3 - distToPreferred);
      let themeBoost = 0;
      if (prioritizeWeak) {
        const m = masteryByTheme.get(c.theme) ?? 0.5;
        const gap = Math.max(0, MASTERY_GOAL - m);
        themeBoost = weakIntensity * (4 * (1 - m) + (gap > 0 ? 3 : 0));
      }
      // Per-theme user preference: adds/subtracts a strong bias on top of the
      // global weak-theme slider.
      const pref = themePrefs[c.theme];
      const prefBias = pref === "priority" ? 3 : pref === "avoid" ? -3 : 0;
      // Softer level weight when weak-theme priority is on; scales with intensity.
      const levelWeight = prioritizeWeak ? Math.max(0.1, 1 - 0.5 * weakIntensity) : 1;
      const effLevelFit = levelFit * levelWeight;
      return { c, score: unread + effLevelFit + themeBoost + prefBias };
    });

    // DP over integer minutes to find the combination whose total is closest to
    // targetMin. On ties: higher aggregate score wins, then fewer items.
    const CAP = Math.max(targetMin * 2, targetMin + 10);
    const itemCap = maxItems && maxItems > 0 ? maxItems : scored.length;
    type Cell = { score: number; count: number; picked: number[] } | null;
    const dp: Cell[] = new Array(CAP + 1).fill(null);
    dp[0] = { score: 0, count: 0, picked: [] };
    scored.forEach((s, i) => {
      const d = Math.max(1, Math.round(s.c.duration_min));
      // Iterate descending so each item is used at most once.
      for (let w = CAP; w >= d; w--) {
        const prev = dp[w - d];
        if (!prev) continue;
        if (prev.count + 1 > itemCap) continue;
        const cand: Cell = {
          score: prev.score + s.score,
          count: prev.count + 1,
          picked: [...prev.picked, i],
        };
        const cur = dp[w];
        if (
          !cur ||
          cand.score > cur.score ||
          (cand.score === cur.score && cand.count < cur.count)
        ) {
          dp[w] = cand;
        }
      }
    });

    let bestW = -1;
    let bestDiff = Infinity;
    for (let w = 1; w <= CAP; w++) {
      if (!dp[w]) continue;
      const diff = Math.abs(w - targetMin);
      const cur = dp[w]!;
      if (
        diff < bestDiff ||
        (diff === bestDiff &&
          bestW >= 0 &&
          (cur.score > dp[bestW]!.score ||
            (cur.score === dp[bestW]!.score && cur.count < dp[bestW]!.count)))
      ) {
        bestDiff = diff;
        bestW = w;
      }
    }
    if (bestW < 0) return;
    const chosen = dp[bestW]!.picked.map((i) => scored[i]);
    // Order by score desc so the most relevant piece opens first.
    chosen.sort((a, b) => b.score - a.score);
    const slugs = chosen.map((s) => s.c.slug);
    if (!slugs.length) return;
    // Per-item explanation strings for the queue banner on each content page.
    const reasons: Record<string, string[]> = {};
    for (const s of chosen) {
      const c = s.c;
      const list: string[] = [];
      const cIdx = levelOrder.indexOf(c.level);
      if (cIdx === prefIdx) list.push(t.queueReasonPreferredLevel);
      else if (c.level === userLevel) list.push(t.queueReasonAtLevel);
      else if (cIdx < prefIdx) list.push(t.queueReasonBelowLevel);
      else list.push(t.queueReasonAboveLevel);
      list.push(viewedIds.has(c.id) ? t.queueReasonAlreadyRead : t.queueReasonUnread);
      const pref = themePrefs[c.theme];
      if (pref === "priority") list.push(t.queueReasonThemePriority);
      else if (pref === "avoid" && usedFallback) list.push(t.queueReasonThemeAvoidedFallback);
      if (prioritizeWeak) {
        const m = masteryByTheme.get(c.theme) ?? 0.5;
        const belowGoal = m < MASTERY_GOAL;
        if (weakIntensity >= 1.5 && m < 0.4) list.push(t.queueReasonWeakThemeStrong);
        else if (weakIntensity >= 0.9 && belowGoal) list.push(t.queueReasonWeakThemeMid);
        else if (belowGoal) list.push(t.queueReasonWeakThemeSoft);
        if (weakIntensity <= 0.6) list.push(t.queueReasonDiversity);
      } else if (c.theme === theme) {
        list.push(t.queueReasonThemeMatch);
      }
      reasons[c.slug] = list;
    }
    setQueue({
      theme: opts.prioritizeWeak ? "mixed" : theme,
      level: preferredLevel,
      slugs,
      index: 0,
      createdAt: Date.now(),
      targetMin,
      prioritizeWeak: !!prioritizeWeak,
      weakIntensity: prioritizeWeak ? weakIntensity : undefined,
      reasons,
    });
    navigate({ to: "/explore/$slug", params: { slug: slugs[0] } });
  };

  const durMax: Record<string, number> = { any: Infinity, s: 4, m: 6 };
  const filtered = useMemo(() => {
    return items.filter((c) => {
      if (theme !== "all" && c.theme !== theme) return false;
      if (level !== "all" && c.level !== level) return false;
      if (c.duration_min > (durMax[dur] ?? Infinity)) return false;
      if (query) {
        const q = query.toLowerCase();
        const title = (lang === "fr" ? c.title_fr : c.title_en).toLowerCase();
        const inTags = c.tags.some((tg) => tg.toLowerCase().includes(q));
        if (!title.includes(q) && !inTags) return false;
      }
      return true;
    });
  }, [items, theme, level, dur, query, lang]);

  return (
    <div className="min-h-screen bg-background">
      <AuthedNav />
      <main className="mx-auto w-full max-w-3xl px-6 pb-16">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{t.explore}</p>
        <h1 className="mt-2 font-serif text-4xl">{t.exploreTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.exploreLead}</p>

        <div className="mt-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
            className="w-full rounded-full border bg-card pl-10 pr-4 py-2.5 text-sm"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Chip active={theme === "all"} onClick={() => setTheme("all")}>
            {t.all}
          </Chip>
          {THEMES.map((th) => (
            <Chip key={th} active={theme === th} onClick={() => setTheme(th)}>
              {themeLabel(th)}
            </Chip>
          ))}
          <span className="mx-1 w-px bg-border" />
          <Chip active={level === "all"} onClick={() => setLevel("all")}>
            {t.allLevels}
          </Chip>
          {LEVELS.map((lv) => (
            <Chip key={lv} active={level === lv} onClick={() => setLevel(lv)}>
              {levelLabel(lv)}
            </Chip>
          ))}
          <span className="mx-1 w-px bg-border" />
          <Chip active={dur === "any"} onClick={() => setDur("any")}>
            {t.all}
          </Chip>
          <Chip active={dur === "s"} onClick={() => setDur("s")}>
            ≤ 4 {t.minutes}
          </Chip>
          <Chip active={dur === "m"} onClick={() => setDur("m")}>
            ≤ 6 {t.minutes}
          </Chip>
        </div>

        {recommended.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
              {t.recommended}
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {recommended.map((c) => (
                <ContentCard
                  key={c.id}
                  c={c}
                  themeLabel={themeLabel}
                  levelLabel={levelLabel}
                  highlight
                  reasons={c._reasons}
                  onReinforce={() => setPickingTheme(c.theme)}
                />
              ))}
            </div>
          </section>
        )}

        <section className="mt-10">
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((c) => (
              <ContentCard key={c.id} c={c} themeLabel={themeLabel} levelLabel={levelLabel} />
            ))}
          </div>
        </section>
      </main>
      {pickingTheme && (
        <DurationPicker
          theme={pickingTheme}
          themeLabel={themeLabel(pickingTheme)}
          allThemes={[...THEMES]}
          themeName={themeLabel}
          prefs={themePrefs}
          onPrefsChange={(next) => {
            // Stamp only the themes whose value actually changed vs. current local state.
            const prev = getThemePrefs();
            const now = new Date().toISOString();
            const nextTs: ThemePrefsTs = { ...getThemePrefsTs() };
            const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
            for (const k of keys) {
              if (prev[k] !== next[k]) nextTs[k] = now;
            }
            setThemePrefsState(next);
            // Offline-first: write locally and queue a server sync. If the
            // network is unavailable, the change is retried automatically
            // when the browser goes back online.
            queueSync(next, nextTs);
          }}
          mastery={mastery}
          onCancel={() => setPickingTheme(null)}
          onPick={(min, opts) => {
            const th = pickingTheme;
            setPickingTheme(null);
            buildQueue(th, min, opts);
          }}
        />
      )}
    </div>
  );
}

function DurationPicker({
  theme: _theme,
  themeLabel,
  allThemes,
  themeName,
  prefs,
  onPrefsChange,
  mastery,
  onCancel,
  onPick,
}: {
  theme: string;
  themeLabel: string;
  allThemes: string[];
  themeName: (th: string) => string;
  prefs: ThemePrefs;
  onPrefsChange: (next: ThemePrefs) => void;
  mastery: ThemeMastery[];
  onCancel: () => void;
  onPick: (
    min: number,
    opts: {
      maxItems?: number;
      skipRead?: boolean;
      prioritizeWeak?: boolean;
      weakIntensity?: number;
    },
  ) => void;
}) {
  const { t } = useLang();
  const options = [10, 20, 30];
  const [min, setMin] = useState<number>(20);
  const [maxItems, setMaxItems] = useState<number>(0); // 0 = no limit
  const [skipRead, setSkipRead] = useState<boolean>(false);
  const [prioritizeWeak, setPrioritizeWeak] = useState<boolean>(false);
  const [intensity, setIntensity] = useState<number>(1); // 0.25..2
  const [showRecipe, setShowRecipe] = useState<boolean>(false);
  const itemOptions = [0, 3, 5, 8];

  const masteryByTheme = new Map(mastery.map((m) => [m.theme, m.mastery]));
  const intensityLabel =
    intensity <= 0.6 ? t.intensityLow : intensity <= 1.2 ? t.intensityMid : t.intensityHigh;
  const themeWeights = allThemes.map((th) => {
    const m = masteryByTheme.get(th) ?? 0.5;
    const weakness = 1 - m;
    const boost = prioritizeWeak ? intensity * (4 * weakness + (m < 0.6 ? 3 : 0)) : 0;
    const prefBias = prefs[th] === "priority" ? 3 : prefs[th] === "avoid" ? -3 : 0;
    return { th, m, boost, prefBias, total: boost + prefBias };
  });
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
          {themeLabel}
        </p>
        <h3 className="mt-1 font-serif text-2xl">{t.chooseDuration}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t.chooseDurationLead}</p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {options.map((m) => (
            <button
              key={m}
              onClick={() => setMin(m)}
              className={`rounded-2xl border px-3 py-4 text-center transition ${
                min === m
                  ? "border-primary bg-primary/10"
                  : "bg-background hover:border-primary hover:bg-primary/5"
              }`}
            >
              <div className="font-serif text-2xl">{m}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {t.minutes}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t.maxItems}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {itemOptions.map((n) => (
                <button
                  key={n}
                  onClick={() => setMaxItems(n)}
                  className={`rounded-full px-3 py-1.5 text-xs transition ${
                    maxItems === n
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground hover:bg-secondary/80"
                  }`}
                >
                  {n === 0 ? t.noLimit : n}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={skipRead}
              onChange={(e) => setSkipRead(e.target.checked)}
              className="h-4 w-4 accent-[hsl(var(--primary))]"
            />
            <span>{t.skipRead}</span>
          </label>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={prioritizeWeak}
              onChange={(e) => setPrioritizeWeak(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
            />
            <span>
              {t.prioritizeWeak}
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t.prioritizeWeakHint}
              </span>
            </span>
          </label>
          {prioritizeWeak && (
            <div className="rounded-2xl bg-background/60 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.weakIntensity}
                </p>
                <span className="text-xs font-medium text-primary">
                  {intensity <= 0.6
                    ? t.intensityLow
                    : intensity <= 1.2
                      ? t.intensityMid
                      : t.intensityHigh}
                </span>
              </div>
              <input
                type="range"
                min={0.25}
                max={2}
                step={0.25}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="mt-2 w-full accent-[hsl(var(--primary))]"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">{t.weakIntensityHint}</p>
            </div>
          )}
          <div className="rounded-2xl bg-background/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t.themePrefsTitle}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t.themePrefsHint}</p>
            <div className="mt-2 space-y-1.5">
              {allThemes.map((th) => {
                const cur: ThemePref = prefs[th] ?? "neutral";
                const opts: ThemePref[] = ["priority", "neutral", "avoid"];
                const label = (p: ThemePref) =>
                  p === "priority"
                    ? t.themePrefPriority
                    : p === "avoid"
                      ? t.themePrefAvoid
                      : t.themePrefNeutral;
                return (
                  <div key={th} className="flex items-center justify-between gap-2">
                    <span className="text-xs">{themeName(th)}</span>
                    <div className="flex gap-1">
                      {opts.map((p) => (
                        <button
                          key={p}
                          onClick={() => onPrefsChange({ ...prefs, [th]: p })}
                          className={`rounded-full px-2 py-1 text-[10px] transition ${
                            cur === p
                              ? p === "avoid"
                                ? "bg-destructive text-destructive-foreground"
                                : "bg-primary text-primary-foreground"
                              : "bg-secondary text-foreground hover:bg-secondary/80"
                          }`}
                        >
                          {label(p)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowRecipe((v) => !v)}
          className="mt-4 text-xs text-primary underline-offset-2 hover:underline"
        >
          {showRecipe ? t.recipeHide : t.recipeShow}
        </button>
        {showRecipe && (
          <div className="mt-2 rounded-2xl border border-border bg-background/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t.recipeTitle}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-foreground">{t.recipeFormula}</p>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              {prioritizeWeak
                ? t.recipeSliderOn
                    .replace("{level}", intensityLabel)
                    .replace("{mult}", intensity.toFixed(2))
                : t.recipeSliderOff}
            </p>
            <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
              <li>• {t.recipePrefPriority}</li>
              <li>• {t.recipePrefAvoid}</li>
              <li>• {t.recipePrefNeutral}</li>
            </ul>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t.recipeThemeWeight}
            </p>
            <div className="mt-1 space-y-1">
              {themeWeights.map((w) => {
                const label = themeName(w.th);
                const pref = prefs[w.th] ?? "neutral";
                const badge = pref === "priority" ? "+3" : pref === "avoid" ? "−3" : "0";
                const boostText = prioritizeWeak ? `+${w.boost.toFixed(1)}` : "+0.0";
                const totalTone =
                  w.total > 0.5
                    ? "text-primary"
                    : w.total < 0 && pref === "avoid"
                      ? "text-destructive"
                      : "text-foreground";
                return (
                  <div key={w.th} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate">{label}</span>
                    <span className="text-muted-foreground">
                      <span className="tabular-nums">{boostText}</span>
                      <span className="mx-1">·</span>
                      <span className="tabular-nums">{badge}</span>
                      <span className="mx-1">=</span>
                      <span className={`font-medium tabular-nums ${totalTone}`}>
                        {(w.total >= 0 ? "+" : "") + w.total.toFixed(1)}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={() =>
            onPick(min, {
              maxItems: maxItems || undefined,
              skipRead,
              prioritizeWeak,
              weakIntensity: prioritizeWeak ? intensity : undefined,
            })
          }
          className="mt-5 w-full rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          {t.start}
        </button>
        <button
          onClick={onCancel}
          className="mt-2 w-full rounded-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs transition ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-foreground hover:bg-secondary/80"
      }`}
    >
      {children}
    </button>
  );
}

function ContentCard({
  c,
  themeLabel,
  levelLabel,
  highlight,
  reasons,
  onReinforce,
}: {
  c: Content;
  themeLabel: (t: string) => string;
  levelLabel: (t: string) => string;
  highlight?: boolean;
  reasons?: string[];
  onReinforce?: () => void;
}) {
  const { lang, t } = useLang();
  return (
    <div
      className={`rounded-2xl border p-5 transition hover:shadow-sm ${
        highlight ? "bg-primary/5 border-primary/20" : "bg-card"
      }`}
    >
      <Link to="/explore/$slug" params={{ slug: c.slug }} className="block">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="rounded-full bg-secondary px-2 py-0.5">{themeLabel(c.theme)}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {c.duration_min} {t.minutes}
          </span>
        </div>
        <h3 className="mt-2 font-serif text-lg leading-tight">
          {lang === "fr" ? c.title_fr : c.title_en}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{levelLabel(c.level)}</p>
        {highlight && reasons && reasons.length > 0 && (
          <div className="mt-3 rounded-xl bg-background/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              {t.whyRecommended}
            </p>
            <ul className="mt-1.5 space-y-1">
              {reasons.slice(0, 3).map((r, i) => (
                <li key={i} className="flex gap-1.5 text-xs text-muted-foreground leading-snug">
                  <span aria-hidden className="text-primary">
                    •
                  </span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Link>
      {highlight && onReinforce && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onReinforce();
          }}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {t.reinforceTheme}
        </button>
      )}
    </div>
  );
}
