import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { learnerTypes, preferenceForType } from "../src/lib/learner-types";
import { preferredDestinations } from "../src/lib/learning-preference";
import { DOMAINS } from "../src/lib/catalog";
import { editor, setCode, readCode } from "./editor-helpers";
import { testAccount } from "../scripts/lib/test-account";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { fixtureCheck } from "../src/lib/project-check/fixtures";

const change = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: /맞춤 타입 변경/ });

test("all illustrated types change home sections and menus while keeping every domain reachable", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(learnerTypes[0].title);
  const picker = page.getByRole("region", { name: "나에게 맞는 시작점" });
  await expect(picker.getByRole("radio")).toHaveCount(4);
  const imagePaths = await picker
    .locator("img")
    .evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).src));
  expect(new Set(imagePaths).size).toBe(4);
  await expect
    .poll(() =>
      picker
        .locator("img")
        .evaluateAll((imgs) => imgs.every((img) => (img as HTMLImageElement).naturalWidth > 0)),
    )
    .toBe(true);
  for (const item of learnerTypes) {
    await picker.getByRole("radio", { name: item.name, exact: true }).check();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(item.title);
    await expect(page.locator(".persona-home-primary")).toHaveAttribute(
      "aria-label",
      `${item.name} 우선 콘텐츠`,
    );
    await expect(page.locator("#problem-library")).toHaveCount(item.id === "coder" ? 1 : 0);
    const sidebar = page.getByRole("complementary", { name: "주 메뉴" });
    const destinations = sidebar.locator(
      'a[href="/learn"],a[href="/handoff"],a[href="/project-check"],a[href="/security-check"]',
    );
    await expect(destinations.first()).toHaveAttribute(
      "href",
      preferredDestinations(preferenceForType(item.id))[0].href,
    );
    await expect(sidebar.locator('a[href*="#"]')).toHaveCount(0);
    await expect(
      sidebar.getByRole("region", { name: "분야별 문제" }).getByRole("link"),
    ).toHaveCount(DOMAINS.length);
    await expect(sidebar.locator(".domain-list details, .domain-list summary")).toHaveCount(0);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await picker.screenshot({
        path: `artifacts/persona-${item.id}-${width}-${info.project.name}.png`,
      });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator(".persona-home-primary").getByRole("link").first()).toBeVisible();
    if (info.project.name === "chromium")
      await page
        .locator(".persona-home-primary")
        .screenshot({ path: `artifacts/persona-home-${item.id}.png` });
    const domainLinks = sidebar.getByRole("region", { name: "분야별 문제" }).getByRole("link");
    for (let index = 0; index < DOMAINS.length; index++)
      await expect(domainLinks.nth(index)).toHaveAttribute("href", `/?domain=${DOMAINS[index].id}`);
    await domainLinks.first().click();
    await expect(page).toHaveURL(/domain=frontend/);
    await expect(page.locator("#problem-library")).toBeVisible();
    await page.goto("/");
    await expect(picker.getByRole("radio", { name: item.name, exact: true })).toBeChecked();
  }
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.reload();
  await expect(picker.getByRole("radio", { name: "배포 전 점검", exact: true })).toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  const domains = page.getByRole("region", { name: "분야별 문제" });
  const last = domains.getByRole("link").last();
  await last.click();
  await expect(page).toHaveURL(new RegExp(`domain=${DOMAINS.at(-1)!.id}`));
  await expect(page.locator(".sidebar")).not.toHaveClass(/open/);
  await expect(page.locator("#problem-library")).toBeVisible();
});

test("legacy preferences migrate and the shared dialog changes type away from home with keyboard focus restored", async ({
  page,
}, info) => {
  for (const item of learnerTypes) {
    await page.goto("/learn");
    await page.evaluate((value) => {
      localStorage.removeItem("codefit-learning-preference-v2");
      localStorage.setItem("codefit-learning-preference-v1", JSON.stringify(value));
    }, preferenceForType(item.id));
    await page.reload();
    await expect(change(page)).toContainText(item.name);
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem("codefit-learning-preference-v2") || "null")?.type,
        ),
      )
      .toBe(item.id);
  }
  await change(page).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "맞춤 타입 변경", exact: true });
  const selected = dialog.getByRole("radio", { name: "배포 전 점검", exact: true });
  await selected.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.getByRole("radio", { name: "내 서비스 이해", exact: true })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(change(page)).toBeFocused();
  await expect(change(page)).toContainText("내 서비스 이해");
  await expect(
    page.getByRole("navigation", { name: "서비스 메뉴" }).getByRole("link").nth(1),
  ).toHaveAttribute("href", "/project-check");
  await change(page).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await new AxeBuilder({ page }).include(".persona-modal").analyze()).violations).toEqual(
    [],
  );
  await dialog.screenshot({ path: `artifacts/persona-dialog-${info.project.name}.png` });
  await dialog.getByRole("button", { name: "선택 완료" }).click();
  await expect(change(page)).toBeFocused();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(learnerTypes[2].title);
});

test("image failures do not prevent choosing a type and storage failures are explained", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await page.route("**/images/**", (route) => route.abort());
  await page.goto("/");
  const picker = page.getByRole("region", { name: "나에게 맞는 시작점" });
  await picker.getByRole("radio", { name: "코드 훈련", exact: true }).check();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(learnerTypes[1].title);
  await expect(picker.getByRole("status")).toContainText("현재 화면에서만 적용");
});

test("type switching preserves editor code and the browser choice survives login and logout", async ({
  page,
  context,
  baseURL,
}) => {
  await page.goto("/problems/fe-search-race");
  await editor(page);
  const draft = "// 타입을 바꿔도 유지할 코드\nexport function search() { return []; }";
  await setCode(page, draft);
  await change(page).click();
  const dialog = page.getByRole("dialog", { name: "맞춤 타입 변경", exact: true });
  await dialog.getByRole("radio", { name: "배포 전 점검", exact: true }).check();
  await dialog.getByRole("button", { name: "선택 완료" }).click();
  expect(await readCode(page)).toBe(draft);
  await page.reload();
  await editor(page);
  expect(await readCode(page)).toBe(draft);
  const account = await testAccount(resolve("artifacts/e2e.sqlite"), baseURL!);
  try {
    const id = randomUUID();
    const job = account.store.startJob(account.owner, id, "project-analysis", "persona-resume");
    if (job.state !== "new") throw new Error("fixture reservation failed");
    await account.store.queries.projectChecks.complete(job.lease, { ...fixtureCheck, id });
    const [name, ...value] = account.cookie.split("=");
    await context.addCookies([
      { name, value: value.join("="), url: baseURL!, httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/");
    await expect(change(page)).toContainText("배포 전 점검");
    const project = page.getByRole("region", { name: "내 프로젝트 점검 이어하기" });
    await expect(project).toContainText(fixtureCheck.analysis.title);
    await expect(project).toContainText("기록 조회는 새 분석 횟수를 사용하지 않습니다.");
    await expect(project).not.toContainText("로그인 필요");
    await expect(project.getByRole("link")).toHaveAttribute("href", `/project-check?check=${id}`);
    await context.clearCookies({ name });
    await page.reload();
    await expect(change(page)).toContainText("배포 전 점검");
    await expect(project).not.toContainText(fixtureCheck.analysis.title);
    await expect(project).toContainText("실제 분석은 로그인 필요");
  } finally {
    account.store.db.close();
  }
});
