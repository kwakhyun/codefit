const openGuideEvent = "codefit:open-guide";

/** Opens the start guide from screens that do not show the floating launcher. */
export function openStartGuide() {
  window.dispatchEvent(new Event(openGuideEvent));
}

export function onStartGuideRequest(listener: () => void) {
  window.addEventListener(openGuideEvent, listener);
  return () => window.removeEventListener(openGuideEvent, listener);
}
