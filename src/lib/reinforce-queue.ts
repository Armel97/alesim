const KEY = "alesim:reinforce-queue:v1";

export type ReinforceQueue = {
  theme: string;
  level: string;
  slugs: string[];
  index: number;
  createdAt: number;
  targetMin?: number;
  prioritizeWeak?: boolean;
  weakIntensity?: number;
  reasons?: Record<string, string[]>;
};

export function getQueue(): ReinforceQueue | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ReinforceQueue;
  } catch {
    return null;
  }
}

export function setQueue(q: ReinforceQueue | null) {
  if (typeof window === "undefined") return;
  if (!q) sessionStorage.removeItem(KEY);
  else sessionStorage.setItem(KEY, JSON.stringify(q));
}

export function advanceQueue(currentSlug: string): ReinforceQueue | null {
  const q = getQueue();
  if (!q) return null;
  const idx = q.slugs.indexOf(currentSlug);
  if (idx === -1) return q;
  const next = { ...q, index: idx + 1 };
  setQueue(next);
  return next;
}

export function clearQueue() {
  setQueue(null);
}
