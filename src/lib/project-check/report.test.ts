import { expect, it } from "vitest";
import { projectReportText, verificationTemplate } from "./report";
import { fixtureAssessment, fixtureCheck, fixtureVerificationPlan } from "./fixtures";
import { publicCheck } from "../server/project-check-store";
it("exports feedback and structured plans while leaving observed outcomes blank", () => {
  const check = {
    ...publicCheck(fixtureCheck),
    review: {
      answers: ["설명", "", "", "", ""],
      assessment: {
        ...fixtureAssessment,
        feedback: fixtureAssessment.feedback.map((f) => ({
          ...f,
          verificationPlan: fixtureVerificationPlan,
        })),
      },
    },
  };
  const text = projectReportText(check);
  expect(text).toContain(fixtureVerificationPlan.preparation);
  expect(text).toContain("실제 결과: 미작성");
  expect(text).toContain("AI 코딩 도구에 전달할 요청");
  expect(verificationTemplate(check, 0)).toContain("[직접 확인 후 작성]");
  expect(verificationTemplate(check, 0).length).toBeLessThanOrEqual(2000);
});
it("keeps legacy assessments and unreviewed questions exportable", () => {
  const check = publicCheck(fixtureCheck);
  expect(projectReportText(check)).toContain("내 답변: 미작성");
  expect(verificationTemplate(check, 0)).toContain("실행 순서");
});
