import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { backupSchema } from "../backup";
import { emptyLearning } from "../learn/progress";
import { SqliteStore } from "./sqlite-store";
import {
  aiProgressFromRows,
  aiProgressKey,
  isAiProgressRow,
  saveAiProgress,
  validAiProgress,
} from "./ai-learning-progress";
import { prepareBackup } from "./workspace-backup";

const stores: SqliteStore[] = [];
function store() {
  const s = new SqliteStore(":memory:");
  stores.push(s);
  return s;
}
afterEach(() => {
  for (const s of stores.splice(0)) s.db.close();
});
const lesson = (patch: object) => ({
  step: 2,
  experiment: "a",
  completed: false,
  answer: null,
  checked: false,
  wrong: [],
  version: 2,
  updatedAt: 1,
  ...patch,
});

describe("AI lesson progress on the server", () => {
  it("merges each device's copy instead of overwriting it", async () => {
    const s = store();
    const owner = `user:${randomUUID()}`;
    await saveAiProgress(s.queries.learning, owner, {
      langchain: validAiProgress(
        "langchain",
        lesson({ completed: true, firstAttemptCorrect: true }),
      )!,
    });
    const merged = await saveAiProgress(s.queries.learning, owner, {
      langchain: validAiProgress(
        "langchain",
        lesson({ step: 0, updatedAt: 5, firstAttemptCorrect: false }),
      )!,
      langgraph: validAiProgress("langgraph", lesson({ step: 1 }))!,
    });
    expect(merged.langchain).toMatchObject({
      completed: true,
      step: 0,
      firstAttemptCorrect: false,
    });
    const rows = await s.queries.learning.all(owner);
    expect(rows.filter(isAiProgressRow)).toHaveLength(2);
    expect(aiProgressFromRows(rows)).toMatchObject({
      langchain: { completed: true },
      langgraph: { step: 1 },
    });
    // An identical save does not create a new revision.
    const before = (await s.queries.learning.get(owner, aiProgressKey("langgraph")))!.codeRevision;
    await saveAiProgress(s.queries.learning, owner, { langgraph: merged.langgraph! });
    expect((await s.queries.learning.get(owner, aiProgressKey("langgraph")))!.codeRevision).toBe(
      before,
    );
  });
  it("rejects records that do not match the lesson", () => {
    expect(validAiProgress("langchain", { step: 9 })).toBeNull();
    expect(validAiProgress("langchain", lesson({ answer: "zz", wrong: ["zz"] }))).toMatchObject({
      answer: null,
      wrong: [],
    });
  });
  it("travels in workspace backups next to mission records", async () => {
    const s = store();
    const owner = `user:${randomUUID()}`;
    const target = `user:${randomUUID()}`;
    await s.queries.learning.save(owner, "where-data-lives", JSON.stringify(emptyLearning()), 0);
    await saveAiProgress(s.queries.learning, owner, {
      langchain: validAiProgress("langchain", lesson({ completed: true }))!,
    });
    const file = backupSchema.parse(await s.exportBackup(owner));
    if (file.version !== 3) throw new Error("expected a v3 backup");
    expect(file.learning.map((item) => item.id).sort()).toEqual([
      "ai:langchain",
      "where-data-lives",
    ]);
    expect(await s.importBackup(target, file)).toMatchObject({ learning: 2 });
    expect(aiProgressFromRows(await s.queries.learning.all(target)).langchain).toMatchObject({
      completed: true,
    });
    // Older backups without AI records stay valid; forged AI records are rejected before import.
    expect(
      prepareBackup({ ...file, learning: file.learning.filter((i) => !i.id.startsWith("ai:")) })
        .learning,
    ).toHaveLength(1);
    for (const id of ["ai:unknown", "ai:langchain"])
      expect(() =>
        prepareBackup({
          ...file,
          learning: [{ id, content: '{"step":7}', updatedAt: new Date().toISOString() }],
        }),
      ).toThrow();
  });
});
