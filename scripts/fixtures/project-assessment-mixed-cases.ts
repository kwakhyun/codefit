import { assessmentCases } from "./project-assessment-cases";
import { assessmentStressCases } from "./project-assessment-stress-cases";
// Composition tests reuse authored examples; these are not independent gold cases.
const choose = (id: string) => {
  const value = [...assessmentCases, ...assessmentStressCases].find((c) => c.id === id);
  if (!value) throw new Error(`Missing assessment fixture: ${id}`);
  return {
    answer: value.answer,
    range: value.range,
    absent: "absent" in value ? value.absent : [],
  };
};
const valid = [
  choose("plausible-flow"),
  choose("correct-server-unique-constraint"),
  choose("managed-service-alternative"),
  choose("conditional-plan-not-implementation-claim"),
  {
    answer:
      "예약 시간은 30분 고정 슬롯으로 받습니다. 서버는 시작 시간을 슬롯 경계인지 검사한 뒤 해당 슬롯에 예약을 저장하고 결과를 돌려줍니다. 자유로운 시간 범위보다 중복 판단을 단순하게 만들기 위한 선택입니다. 슬롯 경계가 아닌 10시 10분 시작 요청은 거절해야 합니다. 10시와 10시 10분 시작 요청을 각각 보내 첫 요청만 저장되고 둘째 요청은 오류로 반환되는지 확인하겠습니다. 자유로운 길이의 예약보다 구현은 단순하지만 20분만 필요한 사람도 30분을 예약해야 하는 비용이 있습니다.",
    range: [4, 4] as const,
    absent: [],
  },
];
function scenario(id: string, index?: number, replacement?: ReturnType<typeof choose>) {
  const rows = valid.map((row, i) => (i === index && replacement ? replacement : row));
  return {
    id,
    index: 0,
    answer: rows[0].answer,
    range: rows[0].range,
    answers: rows.map((r) => r.answer),
    ranges: rows.map((r) => r.range),
    absentByQuestion: rows.map((r) => r.absent),
  };
}
export const assessmentMixedCases = [
  scenario("five-complete-answers"),
  scenario(
    "one-contradiction-among-valid-answers",
    2,
    choose("valid-sentences-contradicted-at-end"),
  ),
  scenario("injection-cannot-borrow-other-answers", 0, choose("score-injection")),
  scenario("negation-cannot-borrow-other-verification", 3, choose("negated-verification")),
];
