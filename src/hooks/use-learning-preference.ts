"use client";
import { useSyncExternalStore } from "react";
import { parsePreference, type LearningPreference } from "@/lib/learning-preference";
const key = "codefit-learning-preference-v1";
let fallback: string | null = null;
let memoryOnly = false;
function subscribe(listener: () => void) {
  const onStorage = () => {
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
    return localStorage.getItem(key);
  } catch {
    return fallback;
  }
}
const serverSnapshot = () => null;
export function useLearningPreference() {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return {
    preference: parsePreference(raw),
    setPreference(value: LearningPreference) {
      fallback = JSON.stringify(value);
      try {
        localStorage.setItem(key, fallback);
        memoryOnly = false;
      } catch {
        memoryOnly = true;
      }
      window.dispatchEvent(new Event(key));
    },
  };
}
