import { expect, type Page } from "@playwright/test";

/** Contrast audits inspect the settled screen, not a frame halfway through a fade. */
export async function waitForUiTransitions(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getAnimations().filter(
            (animation) =>
              (animation.playState === "running" || animation.pending) &&
              animation.effect?.getTiming().iterations !== Infinity &&
              // Closed disclosure children can retain a pending animation in Firefox.
              (!(animation.effect instanceof KeyframeEffect) ||
                !(animation.effect.target instanceof Element) ||
                animation.effect.target.checkVisibility()),
          ).length,
      ),
    )
    .toBe(0);
}

export async function openLabTools(page: Page) {
  const tools = page.locator(".lab-optional-tools");
  await expect(tools).toBeVisible();
  if (!(await tools.evaluate((el) => (el as HTMLDetailsElement).open)))
    await tools.locator(":scope > summary").click();
}
