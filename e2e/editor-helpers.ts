import { expect, type Page } from "@playwright/test";

export async function editor(page: Page) {
  await page.goto("/problems/be-pagination");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await page.waitForFunction(
    () =>
      (
        window as unknown as { monaco?: { editor: { getModels(): unknown[] } } }
      ).monaco?.editor.getModels().length,
  );
}
export async function setCode(page: Page, code: string) {
  await page.evaluate((value) => {
    (
      window as unknown as {
        monaco: { editor: { getModels(): { setValue(value: string): void }[] } };
      }
    ).monaco.editor
      .getModels()[0]
      .setValue(value);
  }, code);
}
export async function readCode(page: Page) {
  return page.evaluate(() =>
    (
      window as unknown as { monaco: { editor: { getModels(): { getValue(): string }[] } } }
    ).monaco.editor
      .getModels()[0]
      .getValue(),
  );
}
