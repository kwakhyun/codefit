import { expect, it } from "vitest";
import { siteOrigin, siteTitle, TITLE_TEMPLATE } from "./site";

it("adds the service name once through the shared template", () => {
  expect(TITLE_TEMPLATE).toBe("%s | CODE:FIT");
  expect(siteTitle("페이지를 찾을 수 없습니다")).toBe("페이지를 찾을 수 없습니다 | CODE:FIT");
});

it("prefers the configured public origin and ignores malformed values", () => {
  expect(siteOrigin({ APP_ORIGIN: "https://lab.example.com/path" })).toBe(
    "https://lab.example.com",
  );
  expect(
    siteOrigin({ APP_ORIGIN: "not a url", AUTH_BASE_URL: "https://codefit.example.com" }),
  ).toBe("https://codefit.example.com");
  expect(siteOrigin({ VERCEL_PROJECT_PRODUCTION_URL: "codefit.example.app" })).toBe(
    "https://codefit.example.app",
  );
  expect(siteOrigin({ APP_ORIGIN: "javascript:alert(1)" })).toBe("http://localhost:3000");
  expect(siteOrigin({})).toBe("http://localhost:3000");
});
