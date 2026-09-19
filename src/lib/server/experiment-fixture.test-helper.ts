import { createHash } from "node:crypto";
import { handoffProblems } from "../../data/handoff-problems";
import {
  emptyTraining,
  experimentRunText,
  observationSourceText,
  type TrainingDraft,
} from "../handoff/training";
import { learningLab } from "./learning-lab";
const p = handoffProblems.find((p) => p.id === "handoff-cart")!;
const lab = learningLab(p);
export const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export function experimentInput() {
  const run = {
    expression:
      "(() => { const items=[{id:'a',quantity:2}]; const next=changeQuantity(items,'a',1); return [items[0].quantity,next[0].quantity]; })()",
    prediction: "어느 쪽도 원본을 바꾸지 않을 것입니다.",
    sourceHash: sha(observationSourceText(p.starterCode, lab)),
    codeHash: sha(p.solution),
    suiteVersion: lab.version,
    original: { id: "experiment", status: "ok" as const, actual: "[3,3]" },
    current: { id: "experiment", status: "ok" as const, actual: "[2,3]" },
  };
  const training: TrainingDraft = {
    ...emptyTraining(),
    prediction: { choice: "preserved", reason: "처음에는 복사한다고 생각했습니다.", locked: true },
    observation: { id: "prediction", status: "ok", actual: "[3,3]" },
    observationSource: run.sourceHash,
    experiment: {
      expression: run.expression,
      prediction: run.prediction,
      run,
      reflection: {
        text: "수정 코드만 원본 수량을 보존했습니다.",
        runHash: sha(experimentRunText(run)),
      },
    },
  };
  return {
    originalCode: p.starterCode,
    currentCode: p.solution,
    lab,
    training,
    evidence: "experiment" as const,
  };
}
