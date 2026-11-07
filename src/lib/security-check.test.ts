import { expect, it } from "vitest";
import {
  compareSecurityReports,
  securityNotesMarkdown,
  securityOrigin,
  type SecurityReport,
} from "./security-check";
const report = (statuses: Record<string, "observed" | "review" | "unknown">): SecurityReport => ({
  url: "https://example.com/",
  checkedAt: "2026-11-07T00:00:00.000Z",
  findings: Object.entries(statuses).map(([id, status]) => ({
    id,
    title: id.toUpperCase(),
    status,
    evidence: "근거 | 표 문자",
    action: "다음 행동",
  })),
});
it("compares two checks of the same origin by observation", () => {
  const diff = compareSecurityReports(
    report({ csp: "review", hsts: "observed", old: "unknown" }),
    report({ csp: "observed", hsts: "observed", frame: "review" }),
  );
  expect(diff.changed).toEqual([{ id: "csp", title: "CSP", before: "review", after: "observed" }]);
  expect(diff.added.map((f) => f.id)).toEqual(["frame"]);
  expect(diff.removed.map((f) => f.id)).toEqual(["old"]);
  expect(diff.unchanged).toBe(1);
  expect(securityOrigin("https://example.com/a?b")).toBe("https://example.com");
  expect(securityOrigin("주소 아님")).toBe("");
});
it("exports Markdown with an escaped findings table and quoted notes", () => {
  const markdown = securityNotesMarkdown(
    ["# 메모\n- 목록", "", ""],
    "https://example.com",
    report({ csp: "review" }),
  );
  expect(markdown).toContain("| 보완 검토 | CSP | 근거 \\| 표 문자 | 다음 행동 |");
  expect(markdown).toContain("> # 메모\n> - 목록");
  expect(markdown).toContain("내 확인 결과: 미작성");
  expect(securityNotesMarkdown(["", "", ""], "", null)).toContain("점검 결과 없음");
});
