import { expect, type Page } from "@playwright/test";

type TestEditor = {
  getAction(id: string): unknown;
  getValue(): string;
  setValue(value: string): void;
};
type EditorWindow = Window & {
  monaco?: { editor: { getEditors(): TestEditor[] } };
};
async function readyEditor(page: Page) {
  // Models exist before @monaco-editor/react commits its mount/change effects.
  // Our save action is registered by onMount in that effect flush. Waiting for it
  // prevents model-only writes that never reach React or the draft controller.
  await page.waitForFunction(() =>
    (window as EditorWindow).monaco?.editor
      .getEditors()
      .some((editor) => editor.getAction("codefit.save")),
  );
}
export async function editor(page: Page) {
  await page.goto("/problems/be-pagination");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await readyEditor(page);
}
export async function setCode(page: Page, code: string) {
  await readyEditor(page);
  await page.evaluate((value) => {
    (window as EditorWindow)
      .monaco!.editor.getEditors()
      .find((editor) => editor.getAction("codefit.save"))!
      .setValue(value);
  }, code);
}
export async function readCode(page: Page) {
  await readyEditor(page);
  return page.evaluate(() =>
    (window as EditorWindow)
      .monaco!.editor.getEditors()
      .find((editor) => editor.getAction("codefit.save"))!
      .getValue(),
  );
}
