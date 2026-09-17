import { describe, expect, it } from "vitest";
import { MISSIONS } from "./catalog";
import { applyAction, initialSimulation, reproduced, simulate, verification } from "./simulation";
import { canComplete, emptyLearning, readLearning, validLearning } from "./progress";
describe("beginner training scenarios", () => {
  for (const m of MISSIONS)
    it(`${m.id}: reproduces a concrete failure and distinguishes incomplete repairs`, () => {
      expect(reproduced(m, [])).toBe(false);
      expect(reproduced(m, m.reproduce)).toBe(true);
      expect(verification(m, "").some((c) => !c.passed)).toBe(true);
      const fixes = m.fixes.filter((f) => verification(m, f.id).every((c) => c.passed));
      expect(fixes).toHaveLength(1);
      expect(simulate(m, m.reproduce).trace).toHaveLength(m.reproduce.length);
      const r = {
        ...emptyLearning(),
        prediction: m.answer,
        reason: "관찰 근거를 남겼습니다",
        locked: true,
        actions: m.reproduce,
        fix: fixes[0].id,
        checked: verification(m, fixes[0].id).map((c) => c.id),
        request: {
          where: "서비스 화면",
          steps: "실제 재현 순서",
          actual: "현재 서비스의 결과",
          expected: "요구한 결과",
          keep: "정상 동작 유지",
        },
        transfer: m.transfer.answer,
        reflection: "다른 사용자와 실패 상황에서도 동작을 확인하겠습니다.",
        completed: true,
      };
      expect(validLearning(m, r)).toBe(true);
      expect(canComplete(m, r)).toBe(true);
      expect(validLearning(m, { ...r, reason: "" })).toBe(true);
      expect(canComplete(m, { ...r, reason: "" })).toBe(true);
      expect(validLearning(m, { ...r, prediction: -1, reason: "" })).toBe(false);
      expect(validLearning(m, { ...r, checked: [] })).toBe(false);
      expect(canComplete(m, { ...r, transfer: (m.transfer.answer + 1) % 3 })).toBe(false);
      expect(readLearning(JSON.stringify(r))).toEqual(r);
    });
  it("a browser-local memo survives refresh but does not imply cross-device persistence", () => {
    const m = MISSIONS[0];
    expect(simulate(m, ["save", "refresh"], "browser").memo).not.toBe("");
    expect(simulate(m, ["save", "other-device"], "browser").memo).toBe("");
  });
  it("does not mutate earlier simulation state; unrequested responses do not fabricate results", () => {
    const m = MISSIONS.find((m) => m.app === "search")!,
      s = initialSimulation();
    const next = applyAction(m, s, "respond-old");
    expect(s.trace).toEqual([]);
    expect(next.result).toBe("");
  });
  it("rejects unrelated actions and corrupt records rather than accepting fabricated completion", () => {
    expect(validLearning(MISSIONS[0], { ...emptyLearning(), actions: ["book"] })).toBe(false);
    expect(validLearning(MISSIONS[0], { ...emptyLearning(), completed: true })).toBe(false);
    expect(readLearning('{"version":999}')).toEqual(emptyLearning());
  });
});
