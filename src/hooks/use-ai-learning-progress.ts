"use client";
import { useSyncExternalStore } from "react";
import { AI_PROGRESS_KEY, parseAiProgress, type AiProgress } from "@/lib/ai-learning/progress";
import type { AiLessonId } from "@/lib/ai-learning/catalog";

const EVENT = "codefit:ai-learning";
let memory = "";
let unavailable = false;
function snapshot() {
  try {
    if (!unavailable) memory = window.localStorage.getItem(AI_PROGRESS_KEY) || "";
  } catch {
    unavailable = true;
  }
  return `${unavailable ? "memory" : "saved"}:${memory}`;
}
function subscribe(listener: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === AI_PROGRESS_KEY || event.key === null) listener();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, listener);
  };
}
const serverSnapshot = () => "loading:";

export function useAiLearningProgress() {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const records = parseAiProgress(raw.slice(raw.indexOf(":") + 1));
  function save(id: AiLessonId, progress: AiProgress) {
    // Read the latest value to retain progress written by another tab.
    const current = snapshot();
    const latest = parseAiProgress(current.slice(current.indexOf(":") + 1));
    memory = JSON.stringify({
      version: 1,
      lessons: { ...latest, [id]: { ...progress, updatedAt: Date.now() } },
    });
    try {
      window.localStorage.setItem(AI_PROGRESS_KEY, memory);
      unavailable = false;
    } catch {
      unavailable = true;
    }
    window.dispatchEvent(new Event(EVENT));
  }
  return {
    records,
    save,
    ready: !raw.startsWith("loading:"),
    storageError: raw.startsWith("memory:"),
  };
}
