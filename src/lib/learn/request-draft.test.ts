import { describe, expect, it } from "vitest";
import { MISSIONS } from "./catalog";
import { emptyLearning, learningSchema, requestReady } from "./progress";
import { requestFromObservation } from "./request-draft";
import { simulate } from "./simulation";

describe("observation request drafts", () => {
  it("copies observed facts for every mission without inventing expected behavior", () => {
    for (const mission of MISSIONS) {
      const record = { ...emptyLearning(), actions: mission.reproduce };
      const request = requestFromObservation(mission, record);
      expect(request.where).toContain(mission.title);
      expect(request.steps.length).toBeGreaterThan(0);
      expect(request.actual).toContain(simulate(mission, record.actions).message);
      expect(request.expected).toBe("");
      expect(request.keep).toBe("");
      expect(requestReady({ ...record, request })).toBe(false);
      expect(learningSchema.safeParse({ ...record, request }).success).toBe(true);
    }
  });
  it("keeps the offline condition alongside a misleading success message", () => {
    const m = MISSIONS.find((m) => m.id === "broken-memo")!;
    const request = requestFromObservation(m, { ...emptyLearning(), actions: ["offline", "save"] });
    expect(request.actual).toContain("오프라인");
    expect(request.actual).toContain("저장 완료");
  });
  it("preserves edits and does not substitute the selected repair for observations", () => {
    const mission = MISSIONS.find((m) => m.id === "private-board")!;
    const record = { ...emptyLearning(), actions: mission.reproduce, fix: "owner" };
    record.request = {
      where: "내가 쓴 위치",
      steps: " ",
      actual: "",
      expected: "주인에게만 보이기",
      keep: "주인은 계속 읽기",
    };
    const request = requestFromObservation(mission, record);
    expect(request.where).toBe(record.request.where);
    expect(request.expected).toBe(record.request.expected);
    expect(request.keep).toBe(record.request.keep);
    expect(request.actual).toContain("지민의 비공개 글");
    expect(request.actual).not.toContain("거절");
    expect(record.request.steps).toBe(" ");
    expect(requestFromObservation(mission, { ...record, request })).toEqual(request);
  });
  it("leaves empty observations alone and explicitly marks long traces as truncated", () => {
    const mission = MISSIONS.find((m) => m.id === "private-board")!;
    const record = emptyLearning();
    expect(requestFromObservation(mission, record)).toBe(record.request);
    record.actions = Array.from({ length: 80 }, () => "open-private" as const);
    const request = requestFromObservation(mission, record);
    expect(request.steps).toContain("전체 내용은 실행 기록에서 확인");
    expect(learningSchema.safeParse({ ...record, request }).success).toBe(true);
  });
});
