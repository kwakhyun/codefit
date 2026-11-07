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
  // At 760px and below coding problems open on the 문제 pane; the editor lives under 코드.
  if ((page.viewportSize()?.width ?? Infinity) <= 760)
    await page
      .getByRole("tablist", { name: "작업 화면" })
      .getByRole("tab", { name: "코드", exact: true })
      .click();
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
