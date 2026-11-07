"use client";
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  parsePreference,
  preferenceSeed,
  WORKSPACE_COOKIE,
  type LearningPreference,
} from "@/lib/learning-preference";
import { learnerType, type LearnerType } from "@/lib/learner-types";
const key = "codefit-learning-preference-v2";
const legacyKey = "codefit-learning-preference-v1";
let fallback: string | null = null;
let memoryOnly = false;
/** The server reads the workspace cookie so the first paint already has the right menu order. */
const SeedContext = createContext<string | null>(null);
export function LearningPreferenceSeed({
  value,
  children,
}: {
  value: string | null;
  children: ReactNode;
}) {
  return createElement(SeedContext.Provider, { value }, children);
}
function readCookie() {
  const match = document.cookie.match(new RegExp(`(?:^|; )${WORKSPACE_COOKIE}=([^;]*)`));
  return match?.[1];
}
function writeCookie(type: LearnerType) {
  try {
    document.cookie = `${WORKSPACE_COOKIE}=${type}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    /* The browser choice still applies; only the server's first paint falls back. */
  }
}
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
    // Browser storage stays the source of truth; the cookie covers cleared or blocked storage.
    return (
      localStorage.getItem(key) || localStorage.getItem(legacyKey) || preferenceSeed(readCookie())
    );
  } catch {
    return fallback ?? preferenceSeed(readCookie());
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
  writeCookie(type);
  window.dispatchEvent(new Event(key));
}
export function useLearningPreference() {
  const seed = useContext(SeedContext);
  const raw = useSyncExternalStore(subscribe, snapshot, () => seed);
  const preference = parsePreference(raw);
  const profile = learnerType(preference);
  useEffect(() => {
    if (!raw || memoryOnly) return;
    try {
      if (JSON.parse(raw)?.version !== 3) save(learnerType(parsePreference(raw)).id);
      // Choices saved before the cookie existed reach the server from the next visit on.
      else if (readCookie() !== profile.id) writeCookie(profile.id);
    } catch {
      /* Selection still works without persistent browser storage. */
    }
  }, [raw, profile.id]);
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
