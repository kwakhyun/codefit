import { describe, expect, it } from "vitest";
import type { GeneratedPractice } from "./generated-practice";
import {
  acknowledgePracticeDraft,
  emptyPracticeDraft,
  practiceContent,
  practiceDraftIndex,
  practiceDraftKey,
  practiceDraftSchema,
  practiceDraftView,
  resolvePracticeDraft,
  updatePracticeDraft,
} from "./practice-draft";

const response = {
  choice: 0,
  predictionReason: "조건을 먼저 읽었습니다.",
  note: "",
  completed: false,
};

describe("project practice browser drafts", () => {
  it("isolates accounts, projects, tracks, and regenerated content without resetting on progress saves", () => {
    const keys = [
      practiceDraftKey("guest:a", "one", "code"),
      practiceDraftKey("guest:b", "one", "code"),
      practiceDraftKey("guest:a", "two", "code"),
      practiceDraftKey("guest:a", "one", "service"),
    ];
    expect(new Set(keys).size).toBe(4);
    const saved = {
      createdAt: "2026-10-15T00:00:00.000Z",
      exercises: { code: [{ title: "처음 만든 문제" }], service: [] },
      progress: { code: [], service: [] },
      revision: 0,
    } as unknown as GeneratedPractice;
    expect(
      practiceContent(
        { ...saved, progress: { code: [response], service: [] }, revision: 1 },
        "code",
      ),
    ).toBe(practiceContent(saved, "code"));
    expect(practiceContent({ ...saved, createdAt: "2026-10-16T00:00:00.000Z" }, "code")).not.toBe(
      practiceContent(saved, "code"),
    );
    expect(
      practiceContent({ ...saved, exercises: { ...saved.exercises, code: [] } }, "code"),
    ).not.toBe(practiceContent(saved, "code"));
  });

  it("round-trips each question's prediction, explanation, and current stage across reloads", () => {
    let draft = emptyPracticeDraft("content", []);
    draft = updatePracticeDraft(draft, [], 0, { choice: 1, reason: "첫 예상" }, "first");
    const progress = [{ ...response, completed: true }, response];
    draft = updatePracticeDraft(
      draft,
      progress,
      1,
      { stage: 2, note: "아직 저장하지 않은 설명" },
      "second",
    );
    const restored = practiceDraftSchema.parse(JSON.parse(JSON.stringify(draft)));
    expect(practiceDraftIndex(restored, progress)).toBe(1);
    expect(practiceDraftView(restored, progress, 1).entry).toMatchObject({
      stage: 2,
      note: "아직 저장하지 않은 설명",
    });
    expect(restored.entries[0]).toMatchObject({ choice: 1, reason: "첫 예상" });
  });

  it("keeps a prediction on stage zero until its answer is saved and never opens a locked question", () => {
    const draft = updatePracticeDraft(
      emptyPracticeDraft("content", []),
      [],
      0,
      { stage: 2, choice: 1 },
      "one",
    );
    expect(practiceDraftView(draft, [], 0).entry.stage).toBe(0);
    expect(practiceDraftIndex({ ...draft, active: 2 }, [])).toBe(0);
    expect(practiceDraftIndex({ ...draft, active: 2 }, [response])).toBe(0);
    expect(practiceDraftIndex({ ...draft, active: 2 }, [{ ...response, completed: true }])).toBe(1);
  });

  it("clears only the submitted draft after a save and preserves other questions", () => {
    let draft = updatePracticeDraft(
      emptyPracticeDraft("content", []),
      [],
      0,
      { choice: 0, reason: "내 예상" },
      "one",
    );
    draft = updatePracticeDraft(draft, [response], 1, { choice: 1, reason: "다음 예상" }, "two");
    draft.active = 0;
    const saved = acknowledgePracticeDraft(draft, [response], 0, "one", false);
    expect(saved.active).toBe(0);
    expect(practiceDraftView(saved, [response], 0)).toMatchObject({
      conflict: false,
      entry: { stage: 1, choice: response.choice, reason: response.predictionReason },
    });
    expect(saved.entries[1]).toEqual(draft.entries[1]);
  });

  it("retains a newer draft when an earlier save response arrives", () => {
    let draft = updatePracticeDraft(
      emptyPracticeDraft("content", [response]),
      [response],
      0,
      { note: "보낸 메모", stage: 2 },
      "sent",
    );
    draft = updatePracticeDraft(draft, [response], 0, { note: "그 뒤에 작성한 메모" }, "newer");
    const result = acknowledgePracticeDraft(
      draft,
      [{ ...response, note: "보낸 메모" }],
      0,
      "sent",
      true,
    );
    expect(result).toBe(draft);
    expect(result.entries[0]?.note).toBe("그 뒤에 작성한 메모");
  });

  it("does not move the user back when a delayed save completes after they opened another question", () => {
    const progress = [{ ...response, completed: true }, response];
    const draft = updatePracticeDraft(
      emptyPracticeDraft("content", progress),
      progress,
      0,
      { note: "추가 메모" },
      "sent",
    );
    const moved = { ...draft, active: 1 };
    const result = acknowledgePracticeDraft(
      moved,
      [{ ...progress[0], note: "추가 메모" }, response],
      0,
      "sent",
      false,
    );
    expect(result.active).toBe(1);
    expect(result.entries[0]?.note).toBe("추가 메모");
  });

  it("asks before restoring an edited note over a changed server response", () => {
    const draft = updatePracticeDraft(
      emptyPracticeDraft("content", [response]),
      [response],
      0,
      { note: "내 초안", stage: 2 },
      "draft",
    );
    const remote = [{ ...response, note: "다른 곳에서 저장한 설명", completed: true }];
    expect(practiceDraftView(draft, remote, 0)).toMatchObject({
      conflict: true,
      entry: { note: "다른 곳에서 저장한 설명" },
    });
    const restored = resolvePracticeDraft(draft, remote, 0, true, "restored");
    expect(practiceDraftView(restored, remote, 0)).toMatchObject({
      conflict: false,
      entry: { note: "내 초안", stage: 2, choice: response.choice },
    });
    const discarded = resolvePracticeDraft(draft, remote, 0, false, "discarded");
    expect(practiceDraftView(discarded, remote, 0)).toMatchObject({
      conflict: false,
      entry: { note: "다른 곳에서 저장한 설명" },
    });
  });

  it("keeps a server-saved first prediction immutable when restoring an older unsaved prediction", () => {
    const draft = updatePracticeDraft(
      emptyPracticeDraft("content", []),
      [],
      0,
      { choice: 1, reason: "내 초안" },
      "draft",
    );
    const remote = [{ ...response, note: "이미 저장한 설명" }];
    const restored = resolvePracticeDraft(draft, remote, 0, true, "restored");
    expect(practiceDraftView(restored, remote, 0).entry).toMatchObject({
      choice: 0,
      reason: response.predictionReason,
      note: "이미 저장한 설명",
    });
  });

  it("does not report a conflict for a clean navigation-only draft", () => {
    const draft = updatePracticeDraft(
      emptyPracticeDraft("content", [response]),
      [response],
      0,
      { stage: 2 },
      "navigation",
    );
    const changed = [{ ...response, note: "새 서버 기록", completed: true }];
    expect(practiceDraftView(draft, changed, 0)).toMatchObject({
      conflict: false,
      entry: { note: "새 서버 기록" },
    });
  });

  it("advances after completion and preserves the last explanation stage after finishing all three", () => {
    const progress = [response, response, response];
    const first = updatePracticeDraft(
      emptyPracticeDraft("content", progress),
      progress,
      0,
      { stage: 2 },
      "first",
    );
    expect(
      acknowledgePracticeDraft(first, [{ ...response, completed: true }], 0, "first", true).active,
    ).toBe(1);
    const last = updatePracticeDraft(first, progress, 2, { stage: 2 }, "last");
    const complete = progress.map((item) => ({ ...item, completed: true }));
    const result = acknowledgePracticeDraft(last, complete, 2, "last", true);
    expect(result.active).toBe(2);
    expect(practiceDraftView(result, complete, 2).entry.stage).toBe(2);
  });

  it("rejects malformed browser records instead of using unchecked draft data", () => {
    const draft = updatePracticeDraft(
      emptyPracticeDraft("content", []),
      [],
      0,
      { choice: 0 },
      "one",
    );
    expect(
      practiceDraftSchema.safeParse({
        ...draft,
        entries: [{ ...draft.entries[0], base: "invalid-json" }, null, null],
      }).success,
    ).toBe(false);
    expect(practiceDraftSchema.safeParse({ ...draft, active: 3 }).success).toBe(false);
    expect(practiceDraftSchema.safeParse({ ...draft, entries: [] }).success).toBe(false);
  });
});
