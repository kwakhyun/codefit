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
it("copies recovery to a unique key without deleting another tab's active draft", () => {
  const a = browserDraft("user:a", "problem");
  a.read();
  a.write({ code: "A pending", baseRevision: 1 });
  const b = browserDraft("user:a", "problem");
  expect(b.read()?.code).toBe("A pending");
  b.write({ code: "A pending", baseRevision: 1 });
  expect(Object.keys(localStorage)).toHaveLength(2);
  b.write({ code: "B different", baseRevision: 1 });
  b.write(null);
  expect(a.remaining()).toHaveLength(0);
  expect(Object.values(localStorage).join()).toContain("A pending");
  a.write({ code: "A newer while B saves", baseRevision: 1 });
  expect(Object.values(localStorage).join()).toContain("A newer while B saves");
});
it("never imports another account's draft or legacy guest data into a signed-in account", () => {
  const a = browserDraft("user:a", "problem");
  a.write({ code: "private A", baseRevision: 0 });
  localStorage.setItem(
    "recode-draft:problem",
    JSON.stringify({ code: "guest legacy", at: Date.now() + 9999999 }),
  );
  const b = browserDraft("user:b", "problem");
  expect(b.read()).toBeNull();
  expect(b.remaining()).toEqual([]);
  expect(browserDraft("guest:c", "problem").read()).toEqual({
    code: "guest legacy",
    baseRevision: null,
  });
});
