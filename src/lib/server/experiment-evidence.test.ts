import { expect, it } from "vitest";
import { experimentRunText, coachingEvidenceText } from "../handoff/training";
import { writeHandoffDraft, readHandoffDraft, formatHandoffDraft } from "../handoff/draft";
import { requireExperimentEvidence } from "./experiment-evidence";
import { experimentInput, sha } from "./experiment-fixture.test-helper";
it("keeps reflection bound to both actual reports and preserves the initial prediction through export", () => {
  const input = experimentInput();
  expect(requireExperimentEvidence(input)).toMatchObject({
    reflection: "수정 코드만 원본 수량을 보존했습니다.",
    reportedOriginal: { actual: "[3,3]" },
    reportedCurrent: { actual: "[2,3]" },
  });
  const saved = writeHandoffDraft(input.currentCode, readHandoffDraft("").notes, input.training);
  expect(readHandoffDraft(saved).training).toEqual(input.training);
  expect(formatHandoffDraft(saved)).toContain(
    "실험 후 알게 된 점: 수정 코드만 원본 수량을 보존했습니다.",
  );
  const old = coachingEvidenceText(input.training, "experiment");
  const first = coachingEvidenceText(input.training);
  input.training.experiment!.reflection!.text = "새 설명";
  expect(coachingEvidenceText(input.training, "experiment")).not.toBe(old);
  expect(coachingEvidenceText(input.training)).toBe(first);
});
it.each([
  "source",
  "code",
  "version",
  "expression",
  "prediction",
  "result",
  "result-id",
  "missing-reflection",
  "blank-reflection",
  "old-reflection",
  "malformed-result",
])("rejects %s without evaluating supplied JavaScript", (kind) => {
  const input = experimentInput();
  const e = input.training.experiment!;
  if (kind === "source") input.originalCode += "\n// changed";
  if (kind === "code") input.currentCode = "while(true){}";
  if (kind === "version") input.lab = { ...input.lab, version: "old" };
  if (kind === "expression") e.expression = "42";
  if (kind === "prediction") e.prediction = "new prediction";
  if (kind === "result") e.run!.current.actual = "[9,9]";
  if (kind === "result-id") e.run!.original.id = "wrong";
  if (kind === "missing-reflection") delete e.reflection;
  if (kind === "blank-reflection") e.reflection!.text = "  ";
  if (kind === "old-reflection") e.reflection!.runHash = "0".repeat(64);
  if (kind === "malformed-result") {
    e.run!.current.actual = "not JSON";
    e.reflection!.runHash = sha(experimentRunText(e.run!));
  }
  expect(() => requireExperimentEvidence(input)).toThrow();
});
it("allows an error report for setup coaching but never treats it as a grade", () => {
  const input = experimentInput();
  input.training.experiment!.run!.current = {
    id: "experiment",
    status: "error",
    actual: "SyntaxError",
  };
  input.training.experiment!.reflection!.runHash = sha(
    experimentRunText(input.training.experiment!.run!),
  );
  expect(requireExperimentEvidence(input).reportedCurrent.status).toBe("error");
});
