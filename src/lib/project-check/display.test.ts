import { expect, it } from "vitest";
import {
  allowanceCost,
  detectSource,
  displayName,
  displayOrigin,
  projectDeletion,
} from "./display";
const item = (url: string, title = "예약 서비스", name?: string) => ({
  page: { url },
  analysis: { title },
  ...(name ? { classMetadata: { name, goal: "", revision: 1, updatedAt: "" } } : {}),
});
it("prefers the renamed project name everywhere, then the title, then the repository", () => {
  expect(displayName(item("https://github.com/o/repo", "제목", "내 이름"))).toBe("내 이름");
  expect(displayName(item("https://github.com/o/repo"))).toBe("예약 서비스");
  expect(displayName(item("https://github.com/o/repo", " "))).toBe("repo");
  expect(displayOrigin(item("https://github.com/o/repo"))).toBe("o");
  expect(displayOrigin(item("https://my.example.com/a"))).toBe("my.example.com");
});
it("states the cost, the remaining count and the reset time, with a reason when short", () => {
  const short = allowanceCost({
    label: "분석 횟수",
    cost: 2,
    remaining: 1,
    resetsAt: "2026-11-07T10:00:00.000Z",
    resetLabel: () => "11월 7일 19:00",
  });
  expect(short.summary).toBe("분석 횟수 2회 사용 · 남은 1회 · 11월 7일 19:00 초기화");
  expect(short.insufficient).toBe(true);
  expect(short.reason).toContain("11월 7일 19:00에 다시 채워집니다");
  expect(allowanceCost({ label: "평가 횟수", cost: 1, remaining: 3 }).reason).toBe("");
});
it("lists everything a project deletion removes", () => {
  const { options } = projectDeletion("예약");
  expect(options.title).toBe("프로젝트 삭제");
  expect(options.details.join(" ")).toContain("코드 대화");
  expect(options.details.join(" ")).toContain("AI 워크숍");
});
it("detects the address type the server will read", () => {
  expect(detectSource("https://github.com/o/r")).toBe("repository");
  expect(detectSource("https://git.example.com/team/app.git")).toBe("repository");
  expect(detectSource("https://my-service.com")).toBe("website");
  expect(detectSource("not a url")).toBeNull();
});
