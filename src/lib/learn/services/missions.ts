import type { Mission } from "../catalog";
import { SERVICE_CASES } from "./cases";
import { DISTRACTORS } from "./messages";
import { evaluateService, describeResult } from "./rules";
// Deterministic per-mission order so the correct option does not always sit in the same place.
// Saved records keep indices into the source arrays, so only the rendering order changes.
function seededOrder(seed: string, length: number) {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const order = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i--) {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507) >>> 0;
    const j = hash % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
export function choiceOrder(mission: Mission, part: "prediction" | "transfer") {
  const length = part === "prediction" ? mission.choices.length : mission.transfer.choices.length;
  return mission.service
    ? seededOrder(`${mission.id}:${part}`, length)
    : Array.from({ length }, (_, i) => i);
}
export function serviceMissions(): Mission[] {
  return SERVICE_CASES.map((c) => {
    const normal = c.samples.find((s) => s.expected.allowed) ?? c.samples[0];
    const fixes = [
      {
        id: "label",
        title: "이용 안내 문구 보강",
        detail: `${c.entity} 화면에 조건을 표시하지만 ‘${c.operation}’ 처리 규칙은 그대로 둡니다.`,
      },
      { id: "rule", title: "처리 규칙 수정", detail: c.repair },
      {
        id: "block",
        title: `‘${c.operation}’ 모두 차단`,
        detail: `오류가 생기지 않도록 ‘${normal.label}’ 같은 정상 요청까지 막습니다.`,
      },
    ];
    return {
      id: c.id,
      title: c.title,
      summary: c.summary,
      kind: "foundation",
      concept: c.concept,
      minutes: 7,
      app: "service",
      service: c,
      task: `${c.entity}에서 이용 조건과 실제 처리가 일치하는지 확인합니다. 조건을 읽고, 실행 결과를 비교한 뒤, 수정안을 검사합니다.`,
      prediction: `안내한 이용 조건을 지킨다면, ‘${c.samples[1].label}’은 어떻게 처리해야 할까요?`,
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
      fixes: seededOrder(`${c.id}:fixes`, fixes.length).map((i) => fixes[i]),
      transfer: { ...c.transfer, answer: 0 },
      code: c.code,
    };
  });
}
