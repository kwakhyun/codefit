"use client";
import { useEffect, useRef } from "react";

/** Fade a changed view in place: never remount editable fields or reset focus. */
export function useFadeTransition<T extends HTMLElement>(view: string | number | boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = ref.current?.animate([{ opacity: 0.45 }, { opacity: 1 }], {
      duration: 220,
      easing: "ease-out",
    });
    return () => animation?.cancel();
  }, [view]);
  return ref;
}
