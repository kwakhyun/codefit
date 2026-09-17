import { handoffSpecs } from "../../data/handoff-problems";
import { handoffId } from "../handoff/catalog";
import { LAB_VERSION, type LearningLab } from "../handoff/training";
import type { Problem } from "../problem";
import { HttpError } from "./http";

const probes: Record<string, Omit<LearningLab, "version" | "checkpoints">> = {
  cart: {
    question: "수량을 1 늘린 뒤, 원본과 반환값의 수량은 각각 얼마일까요?",
    choices: [
      { id: "preserved", label: "원본 2, 반환값 3", output: "[2,3]" },
      { id: "shared", label: "원본 3, 반환값 3", output: "[3,3]" },
      { id: "unchanged", label: "원본 2, 반환값 2", output: "[2,2]" },
    ],
    probe: {
      id: "prediction",
      expression:
        "(() => { const items = [{id:'a', quantity:2}]; const next = changeQuantity(items, 'a', 1); return [items[0].quantity, next[0].quantity]; })()",
      note: "같은 항목을 두 배열에서 읽습니다. [원본 수량, 반환 수량] 순서입니다.",
    },
    reflection:
      "배열과 내부 객체의 참조를 따로 따라가 보세요. 바꾸지 않은 항목까지 복사해야 할까요?",
  },
  latest: {
    question: "같은 검색어로 두 번 요청했습니다. 두 번째 응답이 먼저 오면 어떤 순서로 표시될까요?",
    choices: [
      { id: "latest-only", label: '최신 결과만: ["new"]', output: '["new"]' },
      { id: "both", label: '최신 뒤에 오래된 결과: ["new", "old"]', output: '["new","old"]' },
      { id: "old-only", label: '오래된 결과만: ["old"]', output: '["old"]' },
    ],
    probe: {
      id: "prediction",
      expression: handoffSpecs.latest.cases[0].expression,
      note: "검색어는 같지만 요청은 서로 다릅니다. Promise를 직접 완료시켜 응답 순서를 고정합니다.",
    },
    reflection:
      "검색어가 같다는 사실로 같은 요청이라고 판단할 수 있을까요? 요청 시작과 완료를 구분해 보세요.",
  },
  page: {
    question: "빈 목록의 페이지 수는 원본 코드에서 얼마로 계산될까요?",
    choices: [
      { id: "one", label: "1페이지", output: "1" },
      { id: "zero", label: "0페이지", output: "0" },
      { id: "null", label: "값이 없음 (null)", output: "null" },
    ],
    probe: {
      id: "prediction",
      expression: "paginate([], 1, 10).totalPages",
      note: "화면에 필요한 최소 페이지와 현재 계산식의 결과를 구분하세요.",
    },
    reflection:
      "데이터가 없는 상태도 화면의 정상 상태입니다. 계산 결과와 화면의 약속이 일치하나요?",
  },
  config: {
    question: "DEBUG에 문자열 false를 넣으면, debug는 어떤 값일까요?",
    choices: [
      { id: "false", label: "불리언 false", output: "false" },
      { id: "true", label: "불리언 true", output: "true" },
      { id: "string", label: '문자열 "false"', output: '"false"' },
    ],
    probe: {
      id: "prediction",
      expression: "parseConfig({DEBUG:'false', PORT:'8080'}).debug",
      note: "문자열과 불리언은 다릅니다. 정상 동작한다면 그 근거도 설명해 보세요.",
    },
    reflection:
      "이 입력이 정상이더라도 모든 입력이 안전한 것은 아닙니다. 허용되지 않은 문자열은 어떻게 되나요?",
  },
  dedupe: {
    question: "같은 id를 동시에 두 번 호출하면 실제 작업은 몇 번 시작될까요?",
    choices: [
      { id: "once", label: "1번", output: "1" },
      { id: "twice", label: "2번", output: "2" },
      { id: "none", label: "0번", output: "0" },
    ],
    probe: {
      id: "prediction",
      expression:
        "(async () => { let calls = 0; const run = createOnce(async () => ++calls); await Promise.all([run('a'),run('a')]); return calls; })()",
      note: "성공 결과와 진행 중인 작업을 구분합니다. 실행 횟수만 관찰합니다.",
    },
    reflection:
      "한 번 실행됐다는 사실만으로 성공 결과 재사용과 실패 재시도까지 보장할 수 있을까요?",
  },
  total: {
    question: "paid 100원, pending 50원, cancelled 20원을 넣으면 기존 두 합계는 얼마일까요?",
    choices: [
      { id: "preserved", label: "paid 100, pending 50", output: "[100,50]" },
      { id: "cancel-added", label: "paid 120, pending 50", output: "[120,50]" },
      { id: "combined", label: "paid 170, pending 0", output: "[170,0]" },
    ],
    probe: {
      id: "prediction",
      expression:
        "(() => { const result = summarize([{status:'paid',amount:100},{status:'pending',amount:50},{status:'cancelled',amount:20}]); return [result.paid,result.pending]; })()",
      note: "현재 정상인 동작을 먼저 확인합니다. 기능 추가와 버그 수정을 혼동하지 마세요.",
    },
    reflection:
      "기존 합계가 정상이면 무엇을 유지해야 할까요? 취소 합계 추가는 기존 버그와 별개의 요구사항입니다.",
  },
};

/** Exact curated IDs only: an imported problem cannot turn arbitrary data into a trusted suite. */
export function learningLab(problem: Problem): LearningLab {
  const track = problem.handoff?.track;
  if (!track || !probes[track] || problem.id !== handoffId(track, problem.handoff!.variant))
    throw new HttpError(404, "이 문제에는 실행 훈련이 준비되지 않았습니다.");
  return {
    ...probes[track],
    version: LAB_VERSION,
    checkpoints: handoffSpecs[track].cases.map((c, index) => ({ ...c, id: `case-${index + 1}` })),
  };
}
