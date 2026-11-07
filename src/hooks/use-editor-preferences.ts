"use client";

import { useSyncExternalStore } from "react";

const storageKey = "recode-editor-font";
const changeEvent = "codefit-editor-font-change";
const DEFAULT_SIZE = 14;
let memory: number | null = null;

function validSize(value: unknown) {
  const size = Number(value);
  return Number.isInteger(size) && size >= 12 && size <= 20 ? size : null;
}
function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === storageKey) listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(changeEvent, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(changeEvent, listener);
  };
}
function snapshot() {
  if (memory !== null) return memory;
  try {
    return validSize(localStorage.getItem(storageKey)) ?? DEFAULT_SIZE;
  } catch {
    return DEFAULT_SIZE;
  }
}

/** The settings dialog and the editor share one value, so a change applies immediately. */
export function useEditorPreferences() {
  const fontSize = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_SIZE);
  function changeFontSize(size: number) {
    const valid = validSize(size);
    if (valid === null) return;
    try {
      localStorage.setItem(storageKey, String(valid));
      memory = null;
    } catch {
      // Settings still work for this page when storage is unavailable.
      memory = valid;
    }
    window.dispatchEvent(new Event(changeEvent));
  }
  return { fontSize, changeFontSize };
}
