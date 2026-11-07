import { expect, it } from "vitest";
import { projectReportMarkdown, projectReportText, verificationTemplate } from "./report";
import {
  fixtureAssessment,
  fixtureCheck,
  fixtureVerificationPlan,
  fixtureVerificationRecord,
} from "./fixtures";
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
  expect(
    projectReportText(check, {
      revision: 0,
      tasks: [
        {
          questionIndex: 0,
          status: "observed",
          result: "관찰 결과",
          verification: fixtureVerificationRecord,
        },
      ],
    }),
  ).toContain("재현 패턴 기록됨 (자기 기록)");
});
it("keeps legacy assessments and unreviewed questions exportable", () => {
  const check = publicCheck(fixtureCheck);
  expect(projectReportText(check)).toContain("내 답변: 미작성");
  expect(verificationTemplate(check, 0)).toContain("실행 순서");
});
it("exports Markdown with quoted learner text and marks included drafts", () => {
  const check = {
    ...publicCheck(fixtureCheck),
    review: {
      answers: ["# 제목처럼 보이는 답변\n- 목록", "", "", "", ""],
      assessment: fixtureAssessment,
    },
  };
  const markdown = projectReportMarkdown(check, undefined, true);
  expect(markdown).toContain("> # 제목처럼 보이는 답변\n> - 목록");
  expect(markdown).toContain("저장하지 않은 확인 기록 초안이 포함");
  expect(markdown).toContain("## AI 코딩 도구에 전달할 요청");
  expect(projectReportMarkdown(check)).not.toContain("저장하지 않은");
});
