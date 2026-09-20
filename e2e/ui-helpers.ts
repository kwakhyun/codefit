import { expect, type Page } from "@playwright/test";

/** Contrast audits inspect the settled screen, not a frame halfway through a fade. */
export async function waitForUiTransitions(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter(
              (animation) =>
                (animation.playState === "running" || animation.pending) &&
                animation.effect?.getTiming().iterations !== Infinity,
            ).length,
      ),
    )
    .toBe(0);
}
