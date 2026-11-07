import { expect, it } from "vitest";
import { locationTrail, navCurrent } from "./shell-location";

const labels = (path: string, query = "") =>
  locationTrail(path, new URLSearchParams(query)).map((crumb) => crumb.label);

it("names home views by the menu terms", () => {
  expect(labels("/")).toEqual(["홈"]);
  expect(labels("/", "view=bookmarks")).toEqual(["북마크"]);
  expect(labels("/", "view=history")).toEqual(["내 학습 기록"]);
  expect(labels("/", "view=browse")).toEqual(["분야별 코딩 연습"]);
  expect(labels("/", "domain=frontend")).toEqual(["분야별 코딩 연습", "프론트엔드"]);
  expect(labels("/", "domain=unknown")).toEqual(["홈"]);
});

it("places nested pages under the menu item they belong to", () => {
  expect(locationTrail("/problems/fe-search-race", new URLSearchParams())[0]).toEqual({
    label: "분야별 코딩 연습",
    href: "/?view=browse",
  });
  expect(labels("/problems/handoff-cart")).toEqual(["AI 코드 이해 훈련", "문제 풀이"]);
  expect(labels("/project-practice", "mode=service")).toEqual([
    "서비스 원리 배우기",
    "내 프로젝트로 연습",
  ]);
  expect(labels("/project-practice")).toEqual(["AI 코드 이해 훈련", "내 프로젝트로 연습"]);
  expect(labels("/learn/ai/project")).toEqual(["AI 실무 배우기", "내 프로젝트 AI 워크숍"]);
  expect(labels("/learn/ai/langchain")).toEqual(["AI 실무 배우기", "수업"]);
  expect(labels("/learn/where-data-lives")).toEqual(["서비스 원리 배우기", "미션"]);
  expect(labels("/privacy")).toEqual(["개인정보 안내"]);
});

it("does not mislabel unknown routes as a feature", () => {
  expect(labels("/quality")).toEqual(["페이지를 찾을 수 없음"]);
  expect(labels("/learn/ai/a/b")).toEqual(["페이지를 찾을 수 없음"]);
});

it("marks one exact menu item as the current page and its parent for nested screens", () => {
  const current = (href: string, path: string, query = "") =>
    navCurrent(href, path, new URLSearchParams(query));
  expect(current("/", "/")).toBe("page");
  expect(current("/", "/", "view=history")).toBeUndefined();
  expect(current("/?view=history", "/", "view=history")).toBe("page");
  expect(current("/?view=browse", "/", "domain=frontend")).toBe("true");
  expect(current("/?view=browse", "/problems/fe-search-race")).toBe("true");
  expect(current("/?view=browse", "/problems/handoff-cart")).toBeUndefined();
  expect(current("/handoff", "/problems/handoff-cart")).toBe("true");
  expect(current("/learn", "/learn")).toBe("page");
  expect(current("/learn", "/learn/where-data-lives")).toBe("true");
  expect(current("/learn", "/learn/ai")).toBeUndefined();
  expect(current("/learn/ai", "/learn/ai/langchain")).toBe("true");
  expect(current("/learn/ai", "/learn/ai/project")).toBeUndefined();
  expect(current("/learn/ai/project", "/learn/ai/project")).toBe("page");
  expect(current("/handoff", "/project-practice", "mode=code")).toBe("page");
  expect(current("/learn", "/project-practice", "mode=service")).toBe("page");
  expect(current("/project-check", "/project-practice", "mode=service")).toBeUndefined();
  expect(current("/projects", "/projects")).toBe("page");
});
