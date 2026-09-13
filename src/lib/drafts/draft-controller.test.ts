import { describe, expect, it } from "vitest";
import { DraftController, type DraftRecord, type SaveResult } from "./draft-controller";
import type { Progress } from "../problem";
const progress = (code: string, codeRevision: number): Progress => ({
  code,
  codeRevision,
  problemId: "p",
  bookmarked: false,
  hintsViewed: 0,
  solutionViewed: false,
  status: "in-progress",
  updatedAt: "2000-01-01T00:00:00Z",
});
function fixture() {
  let online = true,
    saved: DraftRecord | null = null;
  const requests: { code: string; revision: number; resolve: (value: SaveResult) => void }[] = [];
  const machine = new DraftController({
    online: () => online,
    onSaved: () => {},
    persist: (value) => {
      saved = value;
    },
    save: (code, revision) => new Promise((resolve) => requests.push({ code, revision, resolve })),
  });
  machine.initialize(progress("original", 1), "", null);
  return {
    machine,
    requests,
    saved: () => saved,
    offline: () => {
      online = false;
    },
    online: () => {
      online = true;
    },
  };
}
describe("draft concurrency state machine", () => {
  it("keeps typing during a conflict response and a second conflict during resolution", async () => {
    const f = fixture();
    f.machine.change("A");
    const first = f.machine.flush();
    f.machine.change("A plus typing");
    f.requests[0].resolve({ conflict: progress("B", 2) });
    expect(await first).toBe(false);
    expect(f.machine.getSnapshot()).toMatchObject({
      code: "A plus typing",
      status: { kind: "conflict" },
    });
    expect(await f.machine.flush()).toBe(false);
    expect(f.requests).toHaveLength(1);
    const retry = f.machine.resolve();
    expect(f.requests[1].revision).toBe(2);
    f.machine.change("A still typing");
    f.requests[1].resolve({ conflict: progress("C", 3) });
    expect(await retry).toBe(false);
    expect(f.machine.getSnapshot()).toMatchObject({
      code: "A still typing",
      status: { kind: "conflict", server: { code: "C" } },
    });
    expect(f.saved()?.code).toBe("A still typing");
    const final = f.machine.resolve();
    f.machine.change("A latest");
    f.requests[2].resolve({ saved: progress("A still typing", 4) });
    await Promise.resolve();
    expect(f.requests[3]).toMatchObject({ code: "A latest", revision: 4 });
    f.requests[3].resolve({ saved: progress("A latest", 5) });
    expect(await final).toBe(true);
    expect(f.machine.getSnapshot()).toMatchObject({ code: "A latest", status: { kind: "saved" } });
    expect(f.saved()).toBeNull();
  });
  it("keeps offline drafts with their base revision across reload, regardless of clocks", async () => {
    const f = fixture();
    f.offline();
    f.machine.change("offline");
    expect(await f.machine.flush()).toBe(false);
    expect(f.machine.getSnapshot().status.kind).toBe("offline");
    expect(f.saved()).toEqual({ code: "offline", baseRevision: 1 });
    f.machine.initialize(progress("other device", 2), "", f.saved());
    expect(f.machine.getSnapshot().status.kind).toBe("conflict");
    f.online();
    expect(await f.machine.flush()).toBe(false);
    expect(f.requests).toHaveLength(0);
  });
  it("does not treat a legacy draft without a revision as authorized after editing and reload", () => {
    const f = fixture();
    f.machine.initialize(progress("server", 9), "", { code: "legacy", baseRevision: null });
    f.machine.change("legacy edited");
    expect(f.saved()?.baseRevision).toBeNull();
    f.machine.initialize(progress("server", 9), "", f.saved());
    expect(f.machine.getSnapshot().status.kind).toBe("conflict");
  });
  it("coalesces repeated flushes and saves the most recent edit after an acknowledgement", async () => {
    const f = fixture();
    f.machine.change("first");
    const a = f.machine.flush();
    const b = f.machine.flush();
    f.machine.change("last");
    expect(f.requests).toHaveLength(1);
    f.requests[0].resolve({ saved: progress("first", 2) });
    await Promise.resolve();
    expect(f.requests[1]).toMatchObject({ code: "last", revision: 2 });
    f.requests[1].resolve({ saved: progress("last", 3) });
    expect(await a).toBe(true);
    expect(await b).toBe(true);
  });
});
it("does not claim local durability when browser storage fails", async () => {
  const machine = new DraftController({
    save: async () => {
      throw new Error("offline");
    },
    persist: () => false,
    online: () => false,
    onSaved: () => {},
  });
  machine.initialize(progress("server", 1), "", null);
  machine.change("retained only in memory");
  await machine.flush();
  expect(machine.getSnapshot()).toMatchObject({
    code: "retained only in memory",
    localSaved: false,
    status: { kind: "offline" },
  });
});
