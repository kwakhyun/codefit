import { beforeEach, expect, it, vi } from "vitest";
const { current, getStore } = vi.hoisted(() => ({ current: vi.fn(), getStore: vi.fn() }));
vi.mock("./session", () => ({ session: current }));
vi.mock("./database", () => ({ getStore }));
import { GET, POST, PATCH, DELETE } from "../../app/api/project-check/route";
beforeEach(() => {
  current.mockReset();
  getStore.mockReset();
});
it("blocks guest mutations before fetching pages, consuming quota, or calling AI", async () => {
  current.mockResolvedValue({ owner: "guest", scope: "guest:1", user: null });
  for (const handler of [POST, PATCH, DELETE])
    expect(
      (await handler(new Request("https://codefit.test/api/project-check", { method: "POST" })))
        .status,
    ).toBe(401);
  const response = await GET(new Request("https://codefit.test/api/project-check"));
  expect(await response.json()).toMatchObject({ signedIn: false, checks: [] });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(getStore).not.toHaveBeenCalled();
});
it("requires a matching workspace and rejects unexpected request fields", async () => {
  current.mockResolvedValue({ owner: "user:a", scope: "user:a", user: { id: "a" } });
  expect(
    (await POST(new Request("https://codefit.test/api/project-check", { method: "POST" }))).status,
  ).toBe(409);
  const response = await POST(
    new Request("https://codefit.test/api/project-check", {
      method: "POST",
      headers: { "x-codefit-workspace": "user:a", "content-type": "application/json" },
      body: JSON.stringify({
        requestId: "b9b6c81e-28e0-456f-9a05-2fbc19f2c864",
        url: "https://example.com/",
        consent: true,
        owner: "user:b",
      }),
    }),
  );
  expect(response.status).toBe(400);
  expect(getStore).not.toHaveBeenCalled();
});

const detailRoute = () => import("../../app/api/project-check/[id]/route");
it("requires ownership for deep links and returns a private 404 for absent records", async () => {
  const { GET: detail } = await detailRoute();
  const id = "b9b6c81e-28e0-456f-9a05-2fbc19f2c864";
  const params = Promise.resolve({ id });
  const request = new Request(`https://codefit.test/api/project-check/${id}`, {
    headers: { "x-codefit-workspace": "user:a" },
  });
  current.mockResolvedValue({ owner: "user:a", scope: "user:a", user: { id: "a" } });
  const find = vi.fn().mockResolvedValue(null);
  getStore.mockResolvedValue({ queries: { projectChecks: { detail: find } } });
  expect((await detail(request, { params })).status).toBe(404);
  expect(find).toHaveBeenCalledWith("user:a", id);
  expect((await detail(request, { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
  current.mockResolvedValue({ owner: "user:b", scope: "user:b", user: { id: "b" } });
  expect((await detail(request, { params })).status).toBe(409);
  expect(find).toHaveBeenCalledTimes(1);
  current.mockResolvedValue({ owner: "guest", scope: "guest:1", user: null });
  expect((await detail(request, { params })).status).toBe(401);
});
it("passes an opaque cursor to the owned page query and keeps the response uncached", async () => {
  current.mockResolvedValue({ owner: "user:a", scope: "user:a", user: { id: "a" } });
  const page = vi.fn().mockResolvedValue({ checks: [], nextCursor: "next" });
  getStore.mockResolvedValue({
    queries: { projectChecks: { page, usage: vi.fn().mockResolvedValue({}) } },
  });
  const response = await GET(new Request("https://codefit.test/api/project-check?cursor=previous"));
  expect(page).toHaveBeenCalledWith("user:a", "previous");
  expect(await response.json()).toMatchObject({ nextCursor: "next", checks: [] });
  expect(response.headers.get("cache-control")).toBe("no-store");
});
