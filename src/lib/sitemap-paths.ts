import { seedProblems } from "@/data/problems";
import { AI_LESSONS } from "./ai-learning/catalog";
import { MISSIONS } from "./learn/catalog";

/** Public pages and built-in content. Generated problems and personal records are excluded. */
const PUBLIC_ROUTES = [
  "/",
  "/projects",
  "/project-check",
  "/security-check",
  "/learn",
  "/learn/ai",
  "/learn/ai/project",
  "/handoff",
  "/project-practice",
  "/login",
  "/privacy",
];
export function sitemapPaths() {
  return [
    ...PUBLIC_ROUTES,
    ...AI_LESSONS.map((lesson) => `/learn/ai/${lesson.id}`),
    ...MISSIONS.map((mission) => `/learn/${mission.id}`),
    ...seedProblems.map((problem) => `/problems/${problem.id}`),
  ];
}
