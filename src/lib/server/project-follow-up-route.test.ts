import { beforeEach, expect, it, vi } from "vitest";
const { current, getStore } = vi.hoisted(() => ({ current: vi.fn(), getStore: vi.fn() }));
vi.mock("./session", () => ({ session: current }));
vi.mock("./database", () => ({ getStore }));
import { GET } from "../../app/api/project-check/[id]/capture/route";
import { POST, PATCH } from "../../app/api/project-check/[id]/follow-up/route";
const id = "b9b6c81e-28e0-456f-9a05-2fbc19f2c864";
const context = { params: Promise.resolve({ id }) };
beforeEach(() => {
  current.mockReset();
  getStore.mockReset();
});
it("requires a signed-in matching workspace for screenshots and follow-up writes", async () => {
  current.mockResolvedValue({ owner: "guest", scope: "g", user: null });
  for (const handler of [GET, POST, PATCH])
    expect((await handler(new Request("https://codefit.test/api"), context)).status).toBe(401);
  current.mockResolvedValue({ owner: "user:a", scope: "a", user: { id: "a" } });
  for (const handler of [GET, POST, PATCH])
    expect((await handler(new Request("https://codefit.test/api"), context)).status).toBe(409);
  expect(getStore).not.toHaveBeenCalled();
});
it("reads screenshots only through the authenticated owner and disables caching", async () => {
  current.mockResolvedValue({ owner: "user:a", scope: "a", user: { id: "a" } });
  const get = vi.fn().mockResolvedValue({ page: { captures: [{ screenshot: "YWJj" }] } });
  getStore.mockResolvedValue({ queries: { projectChecks: { get } } });
  const request = new Request("https://codefit.test/api?index=0", {
    headers: { "x-codefit-workspace": "a" },
  });
  const result = await GET(request, context);
  expect(get).toHaveBeenCalledWith("user:a", id);
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  expect(result.headers.get("content-type")).toBe("image/jpeg");
  expect(await result.text()).toBe("abc");
  get.mockResolvedValue(null);
  expect((await GET(request, context)).status).toBe(404);
});
it("rejects a claimed completed task without an observed result and duplicate question indices", async () => {
  current.mockResolvedValue({ owner: "user:a", scope: "a", user: { id: "a" } });
  for (const tasks of [
    Array.from({ length: 5 }, (_, questionIndex) => ({
      questionIndex,
      status: "observed",
      result: "",
    })),
    Array(5).fill({ questionIndex: 0, status: "planned", result: "" }),
  ]) {
    const response = await PATCH(
      new Request("https://codefit.test/api", {
        method: "PATCH",
        headers: { "x-codefit-workspace": "a", "content-type": "application/json" },
        body: JSON.stringify({ revision: 0, tasks }),
      }),
      context,
    );
    expect(response.status).toBe(400);
  }
  expect(getStore).not.toHaveBeenCalled();
});
