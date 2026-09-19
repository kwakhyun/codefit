import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { SqliteStore } from "./sqlite-store";
import { seedProblems } from "../../data/problems";
import { learningFixture } from "./project-learning-contract.test-helper";
import { emptyLearning } from "../learn/progress";
import { BACKUP_MAX_BYTES } from "../backup-limits";
import { restoredProjectId } from "./workspace-backup";
const context = vi.hoisted(() => ({ owner: "source" }));
vi.mock("./session", () => ({ session: async () => ({ owner: context.owner }) }));
let store: SqliteStore;
vi.mock("./database", () => ({ getStore: async () => store }));
import { GET } from "../../app/api/export/route";
import { POST } from "../../app/api/import/route";
beforeEach(() => {
  store = new SqliteStore(":memory:");
  context.owner = "source";
});
afterEach(() => store.db.close());
const request = (body: unknown) =>
  new Request("http://localhost/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
it("API downloads exactly an importable v3 file and restores all recorded learning types", async () => {
  const { owner, id } = await learningFixture(store);
  context.owner = owner;
  await store.queries.projectLearning.get(owner, id);
  await store.queries.learning.save(owner, "where-data-lives", JSON.stringify(emptyLearning()), 0);
  store.saveProgress(owner, seedProblems[0].id, { baseRevision: 0, code: "한글 코드" });
  const download = await GET(new Request("http://localhost/api/export"));
  expect(download.status).toBe(200);
  expect(download.headers.get("Cache-Control")).toBe("no-store");
  expect(download.headers.get("Content-Disposition")).toContain("attachment");
  const text = await download.text();
  expect(JSON.parse(text).version).toBe(3);
  context.owner = "target";
  const response = await POST(
    new Request("http://localhost/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: text,
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ projects: 1, learning: 1 });
  expect(
    await store.queries.projectChecks.get("target", restoredProjectId("target", id)),
  ).toBeTruthy();
});
it("API still accepts v2 files without erasing existing records", async () => {
  store.saveProgress("source", seedProblems[0].id, { code: "keep", baseRevision: 0 });
  const response = await POST(request({ version: 2, problems: [], progress: {}, attempts: [] }));
  expect(response.status).toBe(200);
  expect(store.progressFor("source", seedProblems[0].id)?.code).toBe("keep");
});
it("API rejects corrupt learning before consuming import allowance", async () => {
  const file = {
    ...store.exportBackup("source"),
    learning: [{ id: "where-data-lives", content: "{}", updatedAt: new Date().toISOString() }],
  };
  expect((await POST(request(file))).status).toBe(400);
  expect(store.db.prepare("SELECT COUNT(*) AS n FROM limits").get()?.n).toBe(0);
  expect(await store.queries.learning.all("source")).toEqual([]);
});
it("API rejects oversize declared or streamed bodies and never writes a partial import", async () => {
  const oversized = new Request("http://localhost/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": String(BACKUP_MAX_BYTES + 1) },
    body: "{}",
  });
  expect((await POST(oversized)).status).toBe(413);
  expect(
    (await POST(request({ padding: "가".repeat(Math.ceil(BACKUP_MAX_BYTES / 3)) }))).status,
  ).toBe(413);
  expect(store.progress("source")).toEqual({});
});
it("API restores more than the former 100-new-problem quota within the shared backup limit", async () => {
  const source = new SqliteStore(":memory:");
  try {
    const problems = Array.from({ length: 101 }, (_, i) => ({
      ...seedProblems[0],
      id: `portable-${i}`,
    }));
    source.importBackup("author", { version: 2, problems, progress: {}, attempts: [] });
    const file = source.exportBackup("author");
    const response = await POST(request(file));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ problems: 101 });
    expect(store.exportBackup(context.owner).problems).toHaveLength(101);
  } finally {
    source.db.close();
  }
});

it("API rejects oversized export with a readable error and keeps stored records", async () => {
  store.archiveLegacy(context.owner, "가".repeat(Math.ceil(BACKUP_MAX_BYTES / 3)));
  const response = await GET(new Request("http://localhost/api/export"));
  expect(response.status).toBe(413);
  expect(await response.json()).toMatchObject({ error: expect.stringContaining("4 MB") });
  expect(
    store.db.prepare("SELECT content FROM legacy WHERE owner=?").get(context.owner),
  ).toBeTruthy();
});
it("API accepts the exact UTF-8 request limit and rejects one extra byte", async () => {
  const backup = { version: 2, problems: [], progress: {}, attempts: [], legacy: "한글" };
  const text = JSON.stringify(backup);
  const body = text + " ".repeat(BACKUP_MAX_BYTES - Buffer.byteLength(text));
  const send = (value: string) =>
    POST(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: value,
      }),
    );
  expect((await send(body)).status).toBe(200);
  expect((await send(body + " ")).status).toBe(413);
});
