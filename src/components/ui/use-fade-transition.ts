"use client";
import { useEffect, useRef } from "react";

/**
 * Fade a changed view in place: never remount editable fields or reset focus.
 * The first render is not a change, so a screen appears without a fade.
 */
export function useFadeTransition<T extends HTMLElement>(view: string | number | boolean) {
  const ref = useRef<T>(null);
  const previous = useRef(view);
  useEffect(() => {
    if (previous.current === view) return;
    previous.current = view;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = ref.current?.animate([{ opacity: 0.45 }, { opacity: 1 }], {
      duration: 220,
      easing: "ease-out",
    });
    return () => animation?.cancel();
  }, [view]);
  return ref;
}
