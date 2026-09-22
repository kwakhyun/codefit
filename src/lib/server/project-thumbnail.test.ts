import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SqliteStore } from "./sqlite-store";
import { fixtureCheck } from "../project-check/fixtures";
const m = vi.hoisted(() => ({ session: vi.fn(), getStore: vi.fn() }));
vi.mock("./session", () => ({ session: m.session }));
vi.mock("./database", () => ({ getStore: m.getStore }));
import { GET } from "@/app/api/project-check/[id]/thumbnail/route";
let store: SqliteStore;
const owner = "user:thumbnail";
const context = { params: Promise.resolve({ id: fixtureCheck.id }) };
const request = () =>
  new Request("https://codefit.test/api/thumbnail", { headers: { "x-codefit-workspace": owner } });
beforeEach(() => {
  store = new SqliteStore(":memory:");
  m.getStore.mockResolvedValue(store);
  m.session.mockResolvedValue({ owner, scope: owner, user: { id: "thumbnail" } });
});
afterEach(() => store.db.close());
it("serves an owned stored capture privately and denies another workspace", async () => {
  const claim = store.startJob(owner, fixtureCheck.id, "project-analysis", "input");
  if (claim.state !== "new") throw Error();
  const content = Buffer.from("stored-image");
  await store.queries.projectChecks.complete(claim.lease, {
    ...fixtureCheck,
    page: {
      ...fixtureCheck.page,
      captures: [
        {
          title: "서비스",
          url: "https://example.com",
          text: "",
          screenshot: content.toString("base64"),
        },
      ],
    },
  });
  const response = await GET(request(), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(Buffer.from(await response.arrayBuffer())).toEqual(content);
  m.session.mockResolvedValue({ owner: "user:other", scope: "user:other" });
  expect((await GET(request(), context)).status).toBe(409);
  expect(
    (
      await GET(
        new Request("https://codefit.test", { headers: { "x-codefit-workspace": "user:other" } }),
        context,
      )
    ).status,
  ).toBe(404);
});
it("returns no image for legacy projects without captures", async () => {
  const claim = store.startJob(owner, fixtureCheck.id, "project-analysis", "input");
  if (claim.state !== "new") throw Error();
  await store.queries.projectChecks.complete(claim.lease, {
    ...fixtureCheck,
    page: { ...fixtureCheck.page, captures: [] },
  });
  expect((await GET(request(), context)).status).toBe(204);
});
