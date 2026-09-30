import { expect, it } from "vitest";
import { inspectSecurity } from "./security-check";
import { securityReportText } from "../security-check";
const document = {
  url: "https://example.com/",
  html: "<p>Public page</p>",
  headers: {},
  fetchedAt: "2026-09-20T00:00:00Z",
};
it("does not equate absent settings with exploitable vulnerabilities or absent cookies with safe authentication", () => {
  const report = inspectSecurity(document);
  expect(report.findings.find((f) => f.id === "cookie")?.status).toBe("unknown");
  expect(report.findings.find((f) => f.id === "authorization")?.status).toBe("unknown");
  expect(report.findings.find((f) => f.id === "csp")?.status).toBe("review");
  expect(securityReportText(report)).toContain("공격, 로그인, API 권한 검증은 수행하지 않았습니다");
});
it("report-only, zero HSTS and invalid XFO are not effective protection", () => {
  const report = inspectSecurity({
    ...document,
    headers: {
      "content-security-policy-report-only": "default-src 'self'; frame-ancestors 'none'",
      "strict-transport-security": "max-age=0",
      "x-frame-options": "ALLOW-FROM *",
    },
  });
  for (const id of ["csp", "hsts", "frame"])
    expect(report.findings.find((f) => f.id === id)?.status).toBe("review");
});
it("distinguishes meta CSP from frame restrictions and ignores commented markup", () => {
  const report = inspectSecurity({
    ...document,
    html: '<meta http-equiv="Content-Security-Policy" content="frame-ancestors none">',
  });
  expect(report.findings.find((f) => f.id === "csp")?.status).toBe("unknown");
  expect(report.findings.find((f) => f.id === "frame")?.status).toBe("review");
  const comment = inspectSecurity({
    ...document,
    html: '<!-- <meta http-equiv="Content-Security-Policy"> -->',
  });
  expect(comment.findings.find((f) => f.id === "csp")?.status).toBe("review");
});
it("observes headers without exporting cookie secrets or claiming policy effectiveness", () => {
  const report = inspectSecurity({
    ...document,
    headers: {
      "content-security-policy": "default-src *; frame-ancestors *",
      "strict-transport-security": "max-age=31536000",
      "x-content-type-options": "nosniff",
      "set-cookie": ["session=secret; Secure; HttpOnly", "theme=dark"],
    },
  });
  expect(report.findings.find((f) => f.id === "cookie")?.evidence).toContain("2개 쿠키 중 1개");
  expect(report.findings.find((f) => f.id === "csp")?.evidence).toContain("별도 확인");
  expect(JSON.stringify(report)).not.toContain("secret");
  expect(report.findings.find((f) => f.id === "mime")?.status).toBe("observed");
});
it("accepts the RFC 6797 quoted max-age form but not unbalanced quotes", () => {
  const hsts = (value: string) =>
    inspectSecurity({ ...document, headers: { "strict-transport-security": value } }).findings.find(
      (f) => f.id === "hsts",
    )?.status;
  expect(hsts('max-age="31536000"; includeSubDomains')).toBe("observed");
  expect(hsts('includeSubDomains; MAX-AGE = "300"')).toBe("observed");
  expect(hsts('max-age="0"')).toBe("review");
  expect(hsts('max-age="31536000')).toBe("review");
});
it("reports the final status and redirect route without site-chosen query strings", () => {
  const report = inspectSecurity({
    ...document,
    url: "https://www.example.com/?lang=ko&session=abc",
    status: 403,
    redirects: ["https://example.com/"],
  });
  expect(report.url).toBe("https://www.example.com/");
  expect(report.status).toBe(403);
  expect(report.redirects).toEqual(["https://example.com/"]);
  const text = securityReportText(report);
  expect(text).toContain("이동 경로: https://example.com/ → https://www.example.com/");
  expect(text).toContain("최종 응답 코드 403");
  expect(text).not.toContain("session=abc");
  expect(inspectSecurity(document)).not.toHaveProperty("redirects");
});
