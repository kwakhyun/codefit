import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  fixtureCheck,
  fixtureAssessment,
  fixtureVerificationPlan,
} from "../src/lib/project-check/fixtures";
import { publicCheck } from "../src/lib/server/project-check-store";
test("project-specific plans preserve real-result blanks and export useful handoff", async ({
  page,
}) => {
  const review = {
    answers: Array(5).fill("확인 계획입니다."),
    assessment: {
      ...fixtureAssessment,
      feedback: fixtureAssessment.feedback.map((f) => ({
        ...f,
        verificationPlan: fixtureVerificationPlan,
      })),
    },
  };
  const check = { ...publicCheck(fixtureCheck), review };
  await page.route("**/api/project-check", (route) =>
    route.fulfill({
      json: {
        scope: "user:plan",
        signedIn: true,
        aiReady: true,
        checks: [check],
        usage: {
          analysis: { limit: 2, remaining: 1, resetsAt: null },
          review: { limit: 4, remaining: 3, resetsAt: null },
        },
      },
    }),
  );
  await page.route(`**/api/project-check/${check.id}`, (route) => route.fulfill({ json: check }));
  await page.goto(`/project-check?check=${check.id}`);
  const panel = page.locator("#project-follow-up");
  await expect(
    panel.getByRole("heading", { name: fixtureVerificationPlan.goal }).first(),
  ).toBeVisible();
  const task = panel.locator("details").first();
  await task.getByRole("button", { name: "빈 기록에 확인 양식 채우기" }).click();
  await expect(task.getByRole("textbox")).toHaveValue(/실제 결과: \[직접 확인 후 작성\]/);
  await expect(task.getByRole("combobox")).toHaveValue("planned");
  const downloading = page.waitForEvent("download");
  await panel.getByRole("button", { name: "확인 계획과 AI 수정 요청 내보내기" }).click();
  const text = await readFile((await (await downloading).path())!, "utf8");
  expect(text).toContain(fixtureVerificationPlan.preparation);
  expect(text).toContain("확인 예정");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("owned CORS workflow separates proof from execution and invalidates target changes", async ({
  page,
}) => {
  let runs = 0;
  await page.route("**/api/security-check/audit", (route) => {
    const body = route.request().postDataJSON();
    if (!body.token)
      return route.fulfill({
        json: {
          token: "fixture-proof",
          fileUrl: "https://example.com/.well-known/codefit-security.txt",
          expiresAt: "2099-01-01T00:00:00Z",
        },
      });
    runs++;
    return route.fulfill({
      json: {
        url: body.url,
        checkedAt: new Date().toISOString(),
        ownershipVerified: true,
        status: "review",
        summary: "검사용 Origin과 credentials=true를 관찰했습니다.",
        evidence: [
          {
            label: "임의 Origin",
            origin: "https://probe.invalid",
            status: 200,
            allowOrigin: "https://probe.invalid",
            allowCredentials: "true",
            vary: "Origin",
          },
        ],
        nextStep: "허용 Origin을 대조하세요.",
      },
    });
  });
  await page.goto("/security-check");
  await page.getByLabel("점검할 공개 서비스 링크").fill("https://example.com/");
  await page.getByText("소유권 확인 후 CORS 테스트", { exact: true }).click();
  const panel = page.getByRole("region", { name: "심화 보안 점검" });
  await expect(panel.locator(".security-consent")).toHaveCSS("display", "flex");
  await expect(panel.getByRole("checkbox")).toHaveCSS("width", "16px");
  await panel.getByRole("checkbox").check();
  await panel.getByRole("button", { name: "소유권 확인 파일 발급" }).click();
  await expect(panel.getByText("1. 파일을 배포하세요")).toBeVisible();
  expect(runs).toBe(0);
  await panel.getByRole("button", { name: "소유권 확인하고 CORS 테스트" }).click();
  await expect(panel.getByRole("region", { name: "CORS 테스트 결과" })).toContainText(
    "credentials=true",
  );
  expect(runs).toBe(1);
  await page.getByLabel("점검할 공개 서비스 링크").fill("https://other.example.com/");
  await expect(panel.getByRole("region", { name: "CORS 테스트 결과" })).toHaveCount(0);
  await page.getByText("소유권 확인 후 CORS 테스트", { exact: true }).click();
  await expect(panel.getByRole("button", { name: "소유권 확인 파일 발급" })).toBeDisabled();
});
test("ZAP import is local, scoped and export strips query secrets", async ({ page }) => {
  let scans = 0;
  await page.route("**/api/security-check**", (route) => {
    scans++;
    return route.abort();
  });
  await page.goto("/security-check");
  await page.getByLabel("점검할 공개 서비스 링크").fill("https://example.com/");
  await page.getByText("OWASP ZAP 보고서 가져오기", { exact: true }).click();
  const report = {
    site: [
      {
        "@name": "https://example.com",
        alerts: [
          {
            pluginid: "10020",
            alert: "Frame policy",
            riskcode: "2",
            desc: "Policy missing",
            solution: "Set policy",
            instances: [{ uri: "https://example.com/path?token=SECRET", method: "GET" }],
          },
        ],
      },
    ],
  };
  await page.getByLabel("ZAP Traditional JSON 파일 (최대 4MB)").setInputFiles({
    name: "zap.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(report)),
  });
  await expect(page.getByText(/규칙별 알림 1개/)).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "수정 요청과 재검사 기록표 저장" }).click();
  const text = await readFile((await (await downloading).path())!, "utf8");
  expect(text).not.toContain("SECRET");
  expect(text).toContain("GET https://example.com/path");
  expect(scans).toBe(0);
});
