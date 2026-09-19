import { createHash, randomInt, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { fixtureCheck } from "../src/lib/project-check/fixtures";
const { values } = parseArgs({
  options: { out: { type: "string", default: "artifacts/assessment-review" } },
});
const sources = [
  "reports/project-assessment-gpt-5.6-luna-1789750108024.json",
  "reports/project-assessment-gpt-5.6-luna-1789750254048.json",
  "reports/project-assessment-gpt-5.6-luna-1789750480445.json",
  "reports/project-assessment-gpt-5.6-luna-1789750481692.json",
  "reports/project-assessment-gpt-5.6-terra-1789750230469.json",
];
type Entry = {
  case: { id: string; index: number; answer: string };
  result?: {
    feedback: {
      questionIndex: number;
      level: number;
      feedback: string;
      nextStep: string;
      evidence?: Record<string, string | null>;
    }[];
  };
  error?: string;
};
const runs = sources.map((path) => ({
  path,
  bytes: readFileSync(path),
  report: JSON.parse(readFileSync(path, "utf8")),
}));
if (
  runs.some(
    (r) => r.report.entries.length !== 12 || r.report.fixtureHash !== runs[0].report.fixtureHash,
  )
)
  throw new Error("Incomplete or mismatched input set");
const first = runs[0].report.entries as Entry[];
const cases = first.map((entry) => ({
  caseId: randomUUID(),
  question: fixtureCheck.analysis.questions[entry.case.index].question,
  answer: entry.case.answer,
}));
const key: unknown[] = [];
const responses = runs.flatMap((run) =>
  (run.report.entries as Entry[]).map((entry) => {
    const index = first.findIndex((e) => e.case.id === entry.case.id);
    if (index < 0 || first[index].case.answer !== entry.case.answer)
      throw new Error("Changed case");
    const responseId = randomUUID();
    key.push({
      responseId,
      caseId: cases[index].caseId,
      source: run.path,
      sourceCaseId: entry.case.id,
      model: run.report.model,
      version: run.report.rubricVersion,
    });
    const f = entry.result?.feedback.find((f) => f.questionIndex === entry.case.index);
    return {
      responseId,
      caseId: cases[index].caseId,
      status: f ? "response" : "no_response",
      ...(f
        ? { level: f.level, feedback: f.feedback, nextStep: f.nextStep, evidence: f.evidence }
        : {}),
      annotation: { misleadingFeedback: null, actionableNextStep: null, reason: "" },
    };
  }),
);
function shuffle<T>(values: T[]) {
  const copy = structuredClone(values);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
const batch = join(values.out!, randomUUID());
mkdirSync(batch, { recursive: true });
const files: Record<string, string> = {};
function save(name: string, data: unknown) {
  const text = JSON.stringify(data, null, 2) + "\n";
  writeFileSync(join(batch, name), text, { flag: "wx" });
  files[name] = createHash("sha256").update(text).digest("hex");
}
for (const reviewer of ["a", "b"]) {
  save(`reviewer-${reviewer}-answers.json`, {
    purpose:
      "calibration-only; previously used development cases, not a hidden independent benchmark",
    projectContext: fixtureCheck.description,
    reviewerId: reviewer,
    independentOfImplementation: null,
    conflicts: "",
    cases: shuffle(cases).map((item) => ({ ...item, goldLevel: null, rationale: "" })),
  });
  save(`reviewer-${reviewer}-responses.json`, {
    instructions:
      "Complete and lock answers file before opening this file. Keep no-response records; do not silently exclude failures. Rate feedback and next step without seeing model labels.",
    reviewerId: reviewer,
    responses: shuffle(responses),
  });
}
save("coordinator-key.DO-NOT-SHARE.json", key);
save("manifest.json", {
  createdAt: new Date().toISOString(),
  purpose: "blinded calibration, not SOTA proof",
  uniqueCases: cases.length,
  responses: responses.length,
  files,
  sources: runs.map((r) => ({
    path: r.path,
    sha256: createHash("sha256").update(r.bytes).digest("hex"),
  })),
});
writeFileSync(
  join(batch, "README.md"),
  `# 독립 검토자 교정 자료\n\n점수 기준: 0은 관련 설명 없음, 1은 기능 또는 일부 관련 기준 확인, 2는 타당한 처리 흐름, 3은 흐름에 선택 이유와 실패 상황 포함, 4는 여기에 구체적 확인 방법과 대안의 비용을 포함한 설명입니다. 실제 구현을 확인했다고 가정하지 말고 답변의 설명만 평가하세요. 잘못된 흐름은 높은 단계의 근거가 아닙니다. 모른다고 인정한 답변 자체를 잘못된 설명으로 취급하지 않습니다.\n\n담당자는 각 검토자에게 answers 파일만 먼저 전달합니다. 응답 결과를 보기 전에 goldLevel(0~4)과 이유를 작성하고 답변 파일을 확정한 뒤 responses 파일을 전달합니다. 두 검토자는 서로 상의하지 않습니다. 모델 이름을 숨겼지만 문체나 내부 번호로 방식을 추측할 가능성은 남습니다.\n\nresponses의 misleadingFeedback은 실제 근거와 다른 설명 또는 근거 없는 구현 단정이면 true입니다. actionableNextStep은 사용자가 수행할 행동과 관찰할 결과를 제시하면 true입니다. no_response는 두 항목을 null로 두고 실패로 남깁니다. 응답 없음과 낮은 품질을 구분합니다.\n\n두 검토자의 불일치는 처음 판단을 보존한 상태에서 별도 합의하거나 제3자가 판정합니다. 이 자료는 개발에 이미 사용한 12개 사례의 교정용입니다. 독립 검토자가 평가해도 독립 미공개 테스트로 바뀌지는 않습니다.\n\n**coordinator-key.DO-NOT-SHARE.json과 manifest.json은 검토자에게 보내지 마세요.** 파일은 로컬에만 만들었으며 누구에게도 전송하지 않았습니다.\n`,
  { flag: "wx" },
);
console.log(batch);
