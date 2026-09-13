import { domainLabel, LANGUAGES } from "../catalog";
import { publicProblem, type Problem } from "../problem";

export const catalogColumns =
  "id,title,summary,domain,language,difficulty,kind,source,minutes,created_at,search_text";
export function catalogValues(problem: Problem): (string | number)[] {
  const { scenario, requirements, starterCode, examples, ...summary } = publicProblem(problem);
  void scenario;
  void requirements;
  void starterCode;
  void examples;
  const search = [
    problem.title,
    problem.summary,
    ...problem.tags,
    LANGUAGES[problem.language].label,
    domainLabel(problem.domain),
  ]
    .join(" ")
    .toLowerCase();
  return [
    problem.id,
    problem.title,
    JSON.stringify(summary),
    problem.domain,
    problem.language,
    problem.difficulty,
    problem.kind,
    problem.source,
    problem.minutes,
    problem.createdAt,
    search,
  ];
}
