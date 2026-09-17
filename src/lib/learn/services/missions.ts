import type { Mission } from "../catalog";
import { SERVICE_CASES } from "./cases";
import { DISTRACTORS } from "./messages";
import { evaluateService, describeResult } from "./rules";
export function serviceMissions(): Mission[] {
  return SERVICE_CASES.map((c) => ({
    id: c.id,
    title: c.title,
    summary: c.summary,
    kind: "foundation",
    concept: c.concept,
    minutes: 7,
    app: "service",
    service: c,
    task: `${c.entity} 화면입니다. ‘${c.samples[1].label}’을 선택하고 ‘${c.operation}’을 눌러 결과를 확인하세요. ${c.policy}`,
    prediction: `‘${c.samples[1].label}’ 조건에서는 어떤 결과가 나와야 할까요?`,
    choices: [
      describeResult(c, c.samples[1].expected),
      evaluateService(c, 1, "").detail,
      DISTRACTORS[c.id],
    ],
    answer: 0,
    actions: ["case-standard", "case-edge", "case-other", "case-submit"],
    reproduce: ["case-edge", "case-submit"],
    lesson: `${c.fault} ${c.repair}`,
    hint: [`‘${c.samples[1].label}’을 선택하고 처리 결과를 확인하세요.`, c.policy, c.repair],
    fixes: [
      {
        id: "label",
        title: "이용 안내 문구 보강",
        detail: "조건을 화면에 표시하지만 처리 규칙은 유지합니다.",
      },
      { id: "rule", title: "처리 규칙 수정", detail: c.repair },
      {
        id: "block",
        title: "모든 요청 차단",
        detail: "오류가 생기지 않도록 정상 요청까지 막습니다.",
      },
    ],
    transfer: { ...c.transfer, answer: 0 },
    code: c.code,
  }));
}
