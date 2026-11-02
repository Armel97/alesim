import {
  getThemePrefs,
  getThemePrefsTs,
  setThemePrefs,
  setThemePrefsTs,
  type ThemePrefs,
  type ThemePrefsTs,
} from "@/lib/theme-prefs";
import { setMyThemePrefs } from "@/lib/theme-prefs.functions";

const PENDING_KEY = "alesim:theme-prefs:pending:v1";

type Listener = (prefs: ThemePrefs, ts: ThemePrefsTs) => void;
const listeners = new Set<Listener>();

function markPending(dirty: boolean) {
  if (typeof window === "undefined") return;
  if (dirty) localStorage.setItem(PENDING_KEY, "1");
  else localStorage.removeItem(PENDING_KEY);
}

export function isPending(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PENDING_KEY) === "1";
}

export function onSyncApplied(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let flushing = false;

// Debounce window: coalesce bursts of edits (e.g. toggling several themes in
// a row) into a single server round-trip.
const DEBOUNCE_MS = 800;
const MAX_WAIT_MS = 4_000; // guarantee a flush even during a sustained burst
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;

function clearDebounce() {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (maxWaitTimer !== null) {
    clearTimeout(maxWaitTimer);
    maxWaitTimer = null;
  }
}

function fireDebounced() {
  clearDebounce();
  void flushPending();
}

function scheduleDebounced() {
  if (typeof window === "undefined") return;
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fireDebounced, DEBOUNCE_MS);
  // Cap the total wait so a rapid, non-stop burst still syncs eventually.
  if (maxWaitTimer === null) {
    maxWaitTimer = setTimeout(fireDebounced, MAX_WAIT_MS);
  }
}

// Exponential backoff state for the automatic retry loop.
const BACKOFF_MIN_MS = 2_000;
const BACKOFF_MAX_MS = 5 * 60_000; // cap at 5 minutes
let backoffMs = BACKOFF_MIN_MS;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function clearRetry() {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function scheduleRetry() {
  if (typeof window === "undefined") return;
  if (!isPending()) return;
  clearRetry();
  // Jitter ±25% to avoid herd retries across tabs / devices.
  const jitter = backoffMs * (0.75 + Math.random() * 0.5);
  retryTimer = setTimeout(() => {
    void flushPending();
  }, jitter);
  // Double for next attempt, capped.
  backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX_MS);
}

function resetBackoff() {
  backoffMs = BACKOFF_MIN_MS;
  clearRetry();
}

/**
 * Attempt to push the current local state to the server. Safe to call anytime;
 * no-ops when offline or when nothing is pending. Server returns the merged
 * state, which we adopt locally and broadcast to listeners.
 */
export async function flushPending(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  // Any explicit flush cancels a pending debounce — we're syncing right now.
  clearDebounce();
  if (!isPending()) {
    resetBackoff();
    return true;
  }
  if (flushing) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    // Don't waste attempts while offline; the `online` listener will fire us.
    return false;
  }
  flushing = true;
  try {
    const prefs = getThemePrefs();
    const ts = getThemePrefsTs();
    const server = await setMyThemePrefs({ data: { prefs, ts } });
    setThemePrefs(server.prefs);
    setThemePrefsTs(server.ts);
    markPending(false);
    listeners.forEach((fn) => fn(server.prefs, server.ts));
    resetBackoff();
    return true;
  } catch {
    // Failure: back off before the next attempt.
    scheduleRetry();
    return false;
  } finally {
    flushing = false;
  }
}

/**
 * Persist the new prefs locally right away (offline-first), mark the state as
 * pending, then try to push. If the network is down the change stays queued
 * and will be flushed by the reconnect listener or the next call.
 */
export function queueSync(prefs: ThemePrefs, ts: ThemePrefsTs) {
  setThemePrefs(prefs);
  setThemePrefsTs(ts);
  markPending(true);
  // New user action → reset backoff, then debounce so a burst of adjustments
  // collapses into a single network round-trip.
  resetBackoff();
  scheduleDebounced();
}

/**
 * Force any queued edits to flush now (bypasses debounce). Useful before
 * navigation or on `visibilitychange` -> hidden.
 */
export function flushNow(): Promise<boolean> {
  clearDebounce();
  return flushPending();
}

let installed = false;

/**
 * Wire up automatic catch-up: retry when the browser reports it's back online,
 * when the tab regains focus, and on a slow interval as a safety net.
 */
export function installAutoSync() {
  if (typeof window === "undefined" || installed) return () => {};
  installed = true;
  const retryNow = () => {
    // External signal that the network may be healthy again: reset backoff.
    resetBackoff();
    void flushPending();
  };
  window.addEventListener("online", retryNow);
  window.addEventListener("focus", retryNow);
  // If the tab is being hidden / unloaded, don't leave edits sitting in the
  // debounce window — send them right away.
  const flushOnHide = () => {
    if (document.visibilityState === "hidden") void flushNow();
  };
  document.addEventListener("visibilitychange", flushOnHide);
  window.addEventListener("pagehide", flushOnHide);
  // Fire immediately in case something was queued from a previous session.
  retryNow();
  return () => {
    window.removeEventListener("online", retryNow);
    window.removeEventListener("focus", retryNow);
    document.removeEventListener("visibilitychange", flushOnHide);
    window.removeEventListener("pagehide", flushOnHide);
    clearRetry();
    clearDebounce();
    installed = false;
  };
}
