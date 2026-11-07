"use client";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { DomainId } from "@/lib/catalog";

/** Details only the coding screens know; the menu shows them while those screens are open. */
export type NavInfo = { bookmarked?: number; activeDomain?: DomainId };
type ShellValue = {
  openSettings: () => void;
  openHelp: () => void;
  setFocusMode: (on: boolean) => void;
  setNavInfo: (info: NavInfo) => void;
  actionsSlot: HTMLElement | null;
};
const noop = () => {};
export const ShellContext = createContext<ShellValue>({
  openSettings: noop,
  openHelp: noop,
  setFocusMode: noop,
  setNavInfo: noop,
  actionsSlot: null,
});
function useShell() {
  return useContext(ShellContext);
}
/** Renders page-specific buttons into the shared header, after the common actions. */
export function HeaderActions({ children }: { children: ReactNode }) {
  const { actionsSlot } = useShell();
  return actionsSlot ? createPortal(children, actionsSlot) : null;
}
/** Hides the menu while the editor is in focus mode; restores it when the screen closes. */
export function useFocusMode(on: boolean) {
  const { setFocusMode } = useShell();
  useEffect(() => {
    setFocusMode(on);
    return () => setFocusMode(false);
  }, [on, setFocusMode]);
}
export function useNavInfo(bookmarked: number | undefined, activeDomain: DomainId | undefined) {
  const { setNavInfo } = useShell();
  useEffect(() => {
    setNavInfo({ bookmarked, activeDomain });
    return () => setNavInfo({});
  }, [bookmarked, activeDomain, setNavInfo]);
}
