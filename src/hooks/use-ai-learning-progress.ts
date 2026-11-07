"use client";
import { useSyncExternalStore } from "react";
import { api } from "@/lib/client-api";
import {
  AI_PROGRESS_KEY,
  mergeAiProgress,
  parseAiCache,
  sameAiProgress,
  type AiProgress,
  type AiProgressMap,
} from "@/lib/ai-learning/progress";
import { aiContentVersion, type AiLessonId } from "@/lib/ai-learning/catalog";

/**
 * AI lesson progress lives on the server per account or guest browser. localStorage is a fast
 * cache tagged with the workspace scope it belongs to; an untagged cache predates syncing and is
 * uploaded (merged, never replaced) on the first successful sync.
 */
type SyncResponse = { scope: string; signedIn: boolean; lessons: AiProgressMap };
type SyncState = "idle" | "syncing" | "synced" | "offline";
const EVENT = "codefit:ai-learning";
const PUSH_DELAY = 600;
let memory = "";
let unavailable = false;
let state: SyncState = "idle";
let signedIn = false;
let scope: string | null = null;
let pulling: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const pending = new Set<AiLessonId>();

function read() {
  try {
    if (!unavailable) memory = window.localStorage.getItem(AI_PROGRESS_KEY) || "";
  } catch {
    unavailable = true;
  }
  return parseAiCache(memory);
}
function notify() {
  window.dispatchEvent(new Event(EVENT));
}
function write(owner: string | null, lessons: AiProgressMap) {
  memory = JSON.stringify({ version: 1, ...(owner ? { scope: owner } : {}), lessons });
  try {
    window.localStorage.setItem(AI_PROGRESS_KEY, memory);
    unavailable = false;
  } catch {
    unavailable = true;
  }
  notify();
}
function setState(next: SyncState) {
  if (state === next) return;
  state = next;
  notify();
}
function pick(lessons: AiProgressMap, ids: Iterable<AiLessonId>) {
  const picked: AiProgressMap = {};
  for (const id of ids) if (lessons[id]) picked[id] = lessons[id];
  return picked;
}

async function push(owner: string, lessons: AiProgressMap, keepalive = false) {
  if (!Object.keys(lessons).length) return;
  try {
    const result = await api<SyncResponse>("/api/learn/ai", {
      method: "PUT",
      body: { lessons },
      scope: owner,
      track: false,
      keepalive,
    });
    const cache = read();
    if (result.scope !== owner || cache.scope !== owner) return;
    const merged = { ...cache.lessons };
    for (const [id, record] of Object.entries(result.lessons) as [AiLessonId, AiProgress][])
      merged[id] = mergeAiProgress(cache.lessons[id], record);
    write(owner, merged);
    setState("synced");
  } catch {
    // Local progress stays in the cache; the next sync uploads what the server is missing.
    setState("offline");
  }
}

function pull() {
  if (pulling) return pulling;
  setState(state === "synced" ? "synced" : "syncing");
  pulling = (async () => {
    try {
      // Discover the current account first so a cache from another account is never uploaded.
      const result = await api<SyncResponse>("/api/learn/ai", { scope: null, track: false });
      const cache = read();
      const local = cache.scope === null || cache.scope === result.scope ? cache.lessons : {};
      const merged: AiProgressMap = {};
      const upload: AiLessonId[] = [];
      for (const id of new Set([
        ...Object.keys(local),
        ...Object.keys(result.lessons),
      ]) as Set<AiLessonId>) {
        merged[id] = mergeAiProgress(local[id], result.lessons[id]);
        if (!sameAiProgress(merged[id], result.lessons[id])) upload.push(id);
      }
      scope = result.scope;
      signedIn = result.signedIn;
      write(result.scope, merged);
      setState("synced");
      await push(result.scope, pick(merged, upload));
    } catch {
      setState("offline");
    } finally {
      pulling = null;
    }
  })();
  return pulling;
}

function flush(keepalive = false) {
  clearTimeout(timer);
  timer = undefined;
  if (!pending.size) return;
  const cache = read();
  const ids = [...pending];
  pending.clear();
  // Without a confirmed owner the next pull reconciles these lessons instead.
  if (scope && cache.scope === scope) void push(scope, pick(cache.lessons, ids), keepalive);
  else void pull();
}

let listening = false;
function listenForSync() {
  if (listening) return;
  listening = true;
  const refresh = () => {
    if (document.visibilityState === "visible") void pull();
  };
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("online", refresh);
  window.addEventListener("codefit:backup-imported", refresh);
  window.addEventListener("pagehide", () => flush(true));
  void pull();
}

function snapshot() {
  read();
  return `${unavailable ? "memory" : "saved"}|${state}|${signedIn ? 1 : 0}|${memory}`;
}
function subscribe(listener: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === AI_PROGRESS_KEY || event.key === null) listener();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, listener);
  listenForSync();
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, listener);
  };
}
const serverSnapshot = () => "loading|idle|0|";

export function useAiLearningProgress() {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [mode, sync, member, ...cache] = raw.split("|");
  const records = parseAiCache(cache.join("|")).lessons;
  function save(id: AiLessonId, progress: AiProgress) {
    // Read the latest value to retain progress written by another tab.
    const cache = read();
    write(cache.scope, {
      ...cache.lessons,
      [id]: { ...progress, version: aiContentVersion(id), updatedAt: Date.now() },
    });
    pending.add(id);
    clearTimeout(timer);
    timer = setTimeout(flush, PUSH_DELAY);
  }
  return {
    records,
    save,
    ready: mode !== "loading",
    storageError: mode === "memory",
    /** Progress matches the server copy for the current account or guest browser. */
    synced: sync === "synced",
    /** The last sync failed; progress is kept in this browser until the next sync. */
    offline: sync === "offline",
    signedIn: member === "1",
  };
}
