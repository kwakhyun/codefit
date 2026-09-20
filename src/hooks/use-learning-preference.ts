"use client";
import { useEffect, useSyncExternalStore } from "react";
import { parsePreference, type LearningPreference } from "@/lib/learning-preference";
import { learnerType, type LearnerType } from "@/lib/learner-types";
const key = "codefit-learning-preference-v2";
const legacyKey = "codefit-learning-preference-v1";
let fallback: string | null = null;
let memoryOnly = false;
function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key && event.key !== key && event.key !== legacyKey) return;
    memoryOnly = false;
    fallback = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(key, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(key, listener);
  };
}
function snapshot() {
  if (memoryOnly) return fallback;
  try {
    return localStorage.getItem(key) || localStorage.getItem(legacyKey);
  } catch {
    return fallback;
  }
}
function save(type: LearnerType) {
  fallback = JSON.stringify({ version: 3, type });
  try {
    localStorage.setItem(key, fallback);
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
  window.dispatchEvent(new Event(key));
}
const serverSnapshot = () => null;
export function useLearningPreference() {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const preference = parsePreference(raw);
  const profile = learnerType(preference);
  useEffect(() => {
    if (!raw || memoryOnly) return;
    try {
      if (JSON.parse(raw)?.version !== 3) save(learnerType(parsePreference(raw)).id);
    } catch {
      /* Selection still works without persistent browser storage. */
    }
  }, [raw]);
  return {
    preference,
    profile,
    type: profile.id,
    hasChosen: raw !== null,
    storageError: memoryOnly,
    setType: save,
    setPreference(value: LearningPreference) {
      save(learnerType(value).id);
    },
  };
}
