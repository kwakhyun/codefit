import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { SqliteStore } from "./sqlite-store";
import { fixtureCheck } from "../project-check/fixtures";
import { checkListItem } from "../project-check/types";
it("projects only lightweight fields and paginates related repositories within the owner", async () => {
  const store = new SqliteStore(":memory:");
  try {
    for (let i = 0; i < 23; i++) {
      const id = randomUUID();
      const owner = i === 22 ? "other" : "owner";
      const lease = store.startJob(owner, id, "project-analysis", String(i));
      if (lease.state !== "new") throw Error();
      await store.queries.projectChecks.complete(lease.lease, {
        ...fixtureCheck,
        id,
        classMetadata: {
          name: `분석 ${i}`,
          goal: "권한 확인",
          revision: 1,
          updatedAt: fixtureCheck.createdAt,
        },
        page: {
          ...fixtureCheck.page,
          source: "repository",
          url:
            i === 21
              ? "https://github.com/example/another"
              : `https://github.com/example/project${i % 2 ? ".git/" : ""}`,
        },
      });
    }
    const q = store.queries.projectChecks;
    const first = await q.summaryPage("owner");
    expect(first.checks).toEqual((await q.page("owner")).checks.map(checkListItem));
    expect(JSON.stringify(first)).not.toContain('"questions"');
    expect(JSON.stringify(first)).not.toContain('"text"');
    const related = await q.summaryPage("owner", null, "https://github.com/example/project/");
    expect(related.checks).toHaveLength(20);
    const tail = await q.summaryPage(
      "owner",
      related.nextCursor,
      "https://github.com/example/project/",
    );
    expect(tail.checks).toHaveLength(1);
    expect(tail.nextCursor).toBeNull();
    expect(new Set([...related.checks, ...tail.checks].map((item) => item.id)).size).toBe(21);
    expect((await q.summaryPage("nobody")).checks).toEqual([]);
    expect(
      (await q.summaryPage("owner", null, undefined, "분석 21")).checks.map(
        (item) => item.classMetadata?.name,
      ),
    ).toEqual(["분석 21"]);
    expect((await q.summaryPage("owner", null, undefined, "EXAMPLE/another")).checks).toHaveLength(
      1,
    );
    expect((await q.summaryPage("owner", null, undefined, "%_")).checks).toEqual([]);
    expect((await q.summaryPage("other", null, undefined, "분석 21")).checks).toEqual([]);
  } finally {
    store.db.close();
  }
});
