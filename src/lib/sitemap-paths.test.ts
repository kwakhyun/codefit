import { expect, it } from "vitest";
import { seedProblems } from "@/data/problems";
import { AI_LESSONS } from "./ai-learning/catalog";
import { MISSIONS } from "./learn/catalog";
import { sitemapPaths } from "./sitemap-paths";

it("lists public pages and every built-in lesson, mission and problem once", () => {
  const paths = sitemapPaths();
  expect(new Set(paths).size).toBe(paths.length);
  for (const path of ["/", "/learn", "/learn/ai", "/handoff", "/project-check", "/privacy"])
    expect(paths).toContain(path);
  expect(paths).toContain(`/learn/ai/${AI_LESSONS[0].id}`);
  expect(
    paths.filter((path) => path.startsWith("/learn/ai/") && path !== "/learn/ai/project"),
  ).toHaveLength(AI_LESSONS.length);
  expect(paths).toContain(`/learn/${MISSIONS[0].id}`);
  expect(paths.filter((path) => path.startsWith("/problems/"))).toHaveLength(seedProblems.length);
});

it("leaves out private and machine-only routes", () => {
  expect(sitemapPaths().some((path) => path.startsWith("/api") || path === "/profile")).toBe(false);
});
