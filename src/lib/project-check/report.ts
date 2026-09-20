import type { Check, ProjectPractice } from "./types";
export function projectReportText(check: Check, practice?: ProjectPractice) {
  const review = check.review;
  return [
    `# ${check.analysis.title} — 프로젝트 확인 기록`,
    `대상: ${check.page.url}`,
    `수집: ${check.page.fetchedAt}`,
    `범위: ${check.page.collectionNote || "공개 화면과 작성자가 제공한 설명. 소스와 로그인 후 구현은 확인하지 않았습니다."}`,
    check.analysis.summary,
    "AI 피드백과 확인 계획은 제안이며 실제 구현 검사 결과가 아닙니다. 아래 실제 결과는 작성자의 기록입니다.",
    ...check.analysis.questions.flatMap((q, i) => {
      const f = review?.assessment.feedback.find((f) => f.questionIndex === i);
      const task = (practice || review?.practice)?.tasks.find((t) => t.questionIndex === i);
      const plan = f?.verificationPlan;
      return [
        `\n## ${i + 1}. ${q.area}`,
        q.question,
        `질문 근거 (${q.basis}): ${q.evidence}`,
        `내 답변: ${review?.answers[i] || "미작성"}`,
        ...(f ? [`피드백: ${f.feedback}`, `다음 행동: ${f.nextStep}`] : []),
        ...(plan
          ? [
              `목표: ${plan.goal}`,
              `준비: ${plan.preparation}`,
              ...plan.steps.map((s, j) => `${j + 1}. ${s.action}\n   기대 결과: ${s.expected}`),
              `남길 근거: ${plan.completion}`,
            ]
          : []),
        `확인 상태: ${task?.status === "observed" ? "결과 작성함 (자기 기록)" : task?.status === "blocked" ? "확인하지 못함" : "확인 예정"}`,
        `실제 결과: ${task?.result || "미작성"}`,
      ];
    }),
    "\n## AI 코딩 도구에 전달할 요청",
    "위 피드백과 실제 결과를 코드와 대조해 원인을 확인해 주세요. 구현을 추측하지 말고 필요한 파일을 먼저 확인하세요. 한 항목씩 최소 변경하고, 기존 기능을 유지하는 회귀 테스트와 변경 전후 결과를 제시해 주세요. 실행하지 않은 검증을 완료했다고 쓰지 마세요.",
  ].join("\n\n");
}
export function verificationTemplate(check: Check, index: number) {
  const plan = check.review?.assessment.feedback.find(
    (f) => f.questionIndex === index,
  )?.verificationPlan;
  return (
    plan
      ? [
          `확인 목표: ${plan.goal}`,
          `준비: ${plan.preparation}`,
          ...plan.steps.map(
            (s, i) =>
              `${i + 1}. ${s.action}\n기대 결과: ${s.expected}\n실제 결과: [직접 확인 후 작성]`,
          ),
          `남길 근거: ${plan.completion}`,
        ]
      : ["확인 조건:", "실행 순서:", "기대 결과:", "실제 결과: [직접 확인 후 작성]"]
  )
    .join("\n\n")
    .slice(0, 4000);
}
