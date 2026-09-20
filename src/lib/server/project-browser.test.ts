import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { create, readHtml } = vi.hoisted(() => ({ create: vi.fn(), readHtml: vi.fn() }));
vi.mock("@vercel/sandbox", () => ({ Sandbox: { create } }));
vi.mock("./project-page", async (original) => ({
  ...(await original<typeof import("./project-page")>()),
  readPublicPage: readHtml,
}));
import { readProjectPages, renderPublicProject, browserNetworkPolicy } from "./project-browser";
import { fixtureCheck } from "../project-check/fixtures";
beforeEach(() => {
  create.mockReset();
  readHtml.mockReset();
  vi.stubEnv("PROJECT_BROWSER_SNAPSHOT_ID", "snap_test");
});
afterEach(() => vi.unstubAllEnvs());
it("runs without application secrets, disables IPv6, and always disposes the browser VM", async () => {
  const sandbox = {
    runCommand: vi.fn().mockResolvedValue({ exitCode: 0 }),
    writeFiles: vi.fn(),
    stop: vi.fn().mockResolvedValue(undefined),
    readFileToBuffer: vi.fn().mockResolvedValue(
      Buffer.from(
        JSON.stringify({
          pages: [
            {
              url: "https://example.com/",
              title: "screen",
              text: "공개 화면 본문 ".repeat(30),
              screenshot: "YWJj",
            },
          ],
          failures: [],
        }),
      ),
    ),
  };
  create.mockResolvedValue(sandbox);
  const result = await renderPublicProject("https://example.com/", new AbortController().signal);
  expect(create.mock.calls[0][0]).not.toHaveProperty("env");
  expect(create.mock.calls[0][0]).toMatchObject({
    persistent: false,
    networkPolicy: browserNetworkPolicy,
  });
  expect(sandbox.runCommand.mock.calls[0][0]).toMatchObject({ cmd: "sysctl", sudo: true });
  expect(result.source).toBe("rendered");
  expect(result.captures).toHaveLength(1);
  expect(sandbox.stop).toHaveBeenCalledTimes(1);
  sandbox.runCommand.mockResolvedValue({ exitCode: 1 });
  await expect(
    renderPublicProject("https://example.com/", new AbortController().signal),
  ).rejects.toThrow("restrict browser networking");
  expect(sandbox.stop).toHaveBeenCalledTimes(2);
});
it("labels HTML fallback honestly, and never retries after request cancellation", async () => {
  create.mockRejectedValue(new Error("provider offline"));
  readHtml.mockResolvedValue(fixtureCheck.page);
  const result = await readProjectPages("https://example.com/", new AbortController().signal);
  expect(result.collectionNote).toContain(
    "화면에 실제로 표시된 내용이나 오류인지는 확인하지 못했습니다",
  );
  readHtml.mockClear();
  const controller = new AbortController();
  controller.abort();
  await expect(readProjectPages("https://example.com/", controller.signal)).rejects.toThrow();
  expect(readHtml).not.toHaveBeenCalled();
});
