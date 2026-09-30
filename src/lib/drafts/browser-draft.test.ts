import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserDraft } from "./browser-draft";
function storage() {
  const values: Record<string, string> = {};
  return new Proxy(values, {
    get(target, key) {
      if (key === "getItem") return (k: string) => target[k] ?? null;
      if (key === "setItem")
        return (k: string, v: string) => {
          target[k] = v;
        };
      if (key === "removeItem")
        return (k: string) => {
          delete target[k];
        };
      return target[key as string];
    },
  });
}
beforeEach(() => {
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
});
afterEach(() => vi.unstubAllGlobals());
it("copies recovery to a unique key without deleting another tab's active draft", async () => {
  const a = browserDraft("user:a", "problem");
  a.read();
  a.write({ code: "A pending", baseRevision: 1 });
  const b = browserDraft("user:a", "problem");
  expect(b.read()?.code).toBe("A pending");
  b.write({ code: "A pending", baseRevision: 1 });
  expect(Object.keys(localStorage)).toHaveLength(2);
  b.write({ code: "B different", baseRevision: 1 });
  b.write(null);
  expect(await a.others()).toHaveLength(0);
  expect(Object.values(localStorage).join()).toContain("A pending");
  a.write({ code: "A newer while B saves", baseRevision: 1 });
  expect(Object.values(localStorage).join()).toContain("A newer while B saves");
});
it("never imports another account's draft or legacy guest data into a signed-in account", async () => {
  const a = browserDraft("user:a", "problem");
  a.write({ code: "private A", baseRevision: 0 });
  localStorage.setItem(
    "recode-draft:problem",
    JSON.stringify({ code: "guest legacy", at: Date.now() + 9999999 }),
  );
  const b = browserDraft("user:b", "problem");
  expect(b.read()).toBeNull();
  expect(await b.others()).toEqual([]);
  expect(browserDraft("guest:c", "problem").read()).toEqual({
    code: "guest legacy",
    baseRevision: null,
  });
});
function fakeLocks() {
  const held = new Set<string>();
  return {
    held,
    request: (name: string, callback: () => Promise<void>) => {
      held.add(name);
      return callback().finally(() => held.delete(name));
    },
    query: async () => ({ held: [...held].map((name) => ({ name })), pending: [] }),
  };
}
const settle = () => new Promise((resolve) => setTimeout(resolve));
it("tells closed tabs' drafts from open ones and discards only on request", async () => {
  const locks = fakeLocks();
  vi.stubGlobal("navigator", { locks });
  const open = browserDraft("user:a", "problem");
  open.claim();
  open.write({ code: "open tab", baseRevision: 1 });
  const closed = browserDraft("user:a", "problem");
  closed.claim();
  closed.write({ code: "closed tab", baseRevision: 1 });
  closed.release();
  await settle();
  sessionStorage.removeItem("codefit-draft:user:a:problem");
  const next = browserDraft("user:a", "problem");
  next.claim();
  expect(next.read()).toBeNull();
  const drafts = await next.others();
  expect(drafts.map((d) => [d.record.code, d.live])).toEqual(
    expect.arrayContaining([
      ["open tab", true],
      ["closed tab", false],
    ]),
  );
  next.discard(drafts.find((d) => !d.live)!.key);
  expect((await next.others()).map((d) => d.record.code)).toEqual(["open tab"]);
});
it("drops a recovered draft after newer code is saved unless an open tab still holds it", async () => {
  const locks = fakeLocks();
  vi.stubGlobal("navigator", { locks });
  const before = browserDraft("user:a", "problem");
  before.claim();
  before.write({ code: "before reload", baseRevision: 1 });
  before.release();
  await settle();
  const reloaded = browserDraft("user:a", "problem");
  reloaded.claim();
  expect(reloaded.read()?.code).toBe("before reload");
  reloaded.write({ code: "edited after recovery", baseRevision: 1 });
  reloaded.write(null);
  await settle();
  expect(Object.values(localStorage).join()).not.toContain("before reload");
  // A duplicated tab shares the pointer while the original tab keeps editing its key.
  reloaded.write({ code: "original tab", baseRevision: 2 });
  const clone = browserDraft("user:a", "problem");
  expect(clone.read()?.code).toBe("original tab");
  clone.write({ code: "clone edit", baseRevision: 2 });
  clone.write(null);
  await settle();
  expect(Object.values(localStorage).join()).toContain("original tab");
});
