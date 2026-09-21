"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark";
const storageKey = "codefit-theme-v1";
const changeEvent = "codefit-theme-change";
const ThemeContext = createContext({
  preference: "system" as ThemePreference,
  resolved: "light" as "light" | "dark",
  setPreference: (preference: ThemePreference) => {
    void preference;
  },
});

function validPreference(value: string | null | undefined): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

function apply(preference: ThemePreference) {
  const root = document.documentElement;
  root.dataset.themePreference = preference;
  root.dataset.theme =
    preference === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : preference;
}

function subscribe(notify: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const sync = () => {
    apply(validPreference(document.documentElement.dataset.themePreference));
    notify();
  };
  const storage = (event: StorageEvent) => {
    if (event.storageArea !== localStorage) return;
    if (event.key !== storageKey && event.key !== null) return;
    apply(validPreference(event.newValue));
    notify();
  };
  media.addEventListener("change", sync);
  window.addEventListener("storage", storage);
  window.addEventListener(changeEvent, sync);
  // Another tab can change storage between the head script and hydration.
  try {
    apply(validPreference(localStorage.getItem(storageKey)));
  } catch {
    // Preserve this page's selection when storage is unavailable.
  }
  sync();
  return () => {
    media.removeEventListener("change", sync);
    window.removeEventListener("storage", storage);
    window.removeEventListener(changeEvent, sync);
  };
}

function snapshot() {
  const { themePreference, theme } = document.documentElement.dataset;
  return `${validPreference(themePreference)}:${theme === "dark" ? "dark" : "light"}`;
}
const serverSnapshot = () => "system:light";

function setPreference(preference: ThemePreference) {
  apply(preference);
  try {
    localStorage.setItem(storageKey, preference);
  } catch {
    // The selection still applies for this page when browser storage is unavailable.
  }
  window.dispatchEvent(new Event(changeEvent));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const value = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [preference, resolved] = value.split(":") as [ThemePreference, "light" | "dark"];
  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
