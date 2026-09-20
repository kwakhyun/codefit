import { beforeEach, expect, it, vi } from "vitest";
const { current, getStore } = vi.hoisted(() => ({ current: vi.fn(), getStore: vi.fn() }));
vi.mock("./session", () => ({ session: current }));
vi.mock("./database", () => ({ getStore }));
import { GET, POST } from "../../app/api/project-check/training/route";
const id = "b9b6c81e-28e0-456f-9a05-2fbc19f2c864";
beforeEach(() => {
  current.mockReset();
  getStore.mockReset();
});
it("blocks stale guest and member workspaces before touching private training", async () => {
  current.mockResolvedValue({ owner: "guest", scope: "g", user: null });
  for (const method of [GET, POST])
    expect(
      (await method(new Request(`https://codefit.test/api/project-check/training?id=${id}`)))
        .status,
    ).toBe(409);
  current.mockResolvedValue({ owner: "user:a", scope: "a", user: { id: "a" } });
  expect(
    (await GET(new Request(`https://codefit.test/api/project-check/training?id=${id}`))).status,
  ).toBe(409);
  expect(getStore).not.toHaveBeenCalled();
});
it("returns no-store private data and rejects unexpected fields without an AI dependency", async () => {
  current.mockResolvedValue({ owner: "user:a", scope: "a", user: { id: "a" } });
  const get = vi.fn().mockResolvedValue({ version: 1, revision: 0, modules: [] });
  getStore.mockResolvedValue({ queries: { projectLearning: { get } } });
  const response = await GET(
    new Request(`https://codefit.test/api/project-check/training?id=${id}`, {
      headers: { "x-codefit-workspace": "a" },
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(get).toHaveBeenCalledWith("user:a", id);
  const invalid = await POST(
    new Request("https://codefit.test/api/project-check/training", {
      method: "POST",
      headers: { "x-codefit-workspace": "a", "content-type": "application/json" },
      body: JSON.stringify({ id, owner: "user:b" }),
    }),
  );
  expect(invalid.status).toBe(400);
});
