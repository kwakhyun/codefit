import { createHash } from "node:crypto";
import {
  experimentMatches,
  experimentRunText,
  observationSourceText,
  type LearningLab,
  type TrainingDraft,
} from "../handoff/training";
import { HttpError } from "./http";

/** Validate provenance only. Arbitrary browser results remain client reports, never grades. */
export function requireExperimentEvidence(input: {
  originalCode: string;
  currentCode: string;
  lab: LearningLab;
  training: TrainingDraft;
}) {
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  const experiment = input.training.experiment;
  if (
    !experiment?.run ||
    !experimentMatches(
      experiment,
      hash(observationSourceText(input.originalCode, input.lab)),
      hash(input.currentCode),
      input.lab.version,
    )
  )
    throw new HttpError(
      400,
      "코드나 실험 조건이 바뀌었거나 확인되지 않습니다. 두 코드로 실험을 다시 실행해 주세요.",
    );
  const { run, reflection } = experiment;
  if (!reflection?.text.trim() || reflection.runHash !== hash(experimentRunText(run)))
    throw new HttpError(400, "현재 실험 결과를 보고 알게 된 점을 적은 뒤 질문을 요청해 주세요.");
  for (const result of [run.original, run.current]) {
    if (result.status === "ok") {
      try {
        JSON.parse(result.actual);
      } catch {
        throw new HttpError(
          400,
          "실험 결과의 형식을 확인할 수 없습니다. 실험을 다시 실행해 주세요.",
        );
      }
    }
  }
  return {
    expression: run.expression,
    prediction: run.prediction,
    reportedOriginal: run.original,
    reportedCurrent: run.current,
    reflection: reflection.text,
  };
}
