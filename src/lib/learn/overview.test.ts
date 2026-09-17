import { expect, it } from "vitest";
import type { Progress } from "../problem";
import { emptyLearning } from "./progress";
import { learningOverview } from "./overview";

function draft(
  id: string,
  updatedAt: string,
  code = JSON.stringify({ ...emptyLearning(), reason: "아직 작성 중" }),
): Progress {
  return {
    problemId: `learn:${id}`,
    code,
    updatedAt,
    codeRevision: 1,
    bookmarked: false,
    hintsViewed: 0,
    solutionViewed: false,
    status: "in-progress",
  };
}
it("resumes the latest partial draft even before the prediction is submitted", () => {
  const overview = learningOverview([
    draft("where-data-lives", "2026-09-18T01:00:00Z"),
    draft("follow-a-request", "2026-09-18T02:00:00Z"),
    draft("who-can-read", "2026-09-18T03:00:00Z", "invalid legacy data"),
  ]);
  expect(overview.resume?.mission.id).toBe("follow-a-request");
  expect(overview.next.record.stage).toBe(0);
  expect(overview.complete).toBe(0);
});
it("does not resume empty records or treat an unsupported completion flag as success", () => {
  const empty = learningOverview([
    draft("where-data-lives", "2026-09-18T01:00:00Z", JSON.stringify(emptyLearning())),
  ]);
  expect(empty.resume).toBeUndefined();
  expect(empty.next.mission.id).toBe("where-data-lives");
  expect(
    learningOverview([
      draft(
        "where-data-lives",
        "2026-09-18T01:00:00Z",
        JSON.stringify({ ...emptyLearning(), completed: true }),
      ),
    ]).complete,
  ).toBe(0);
});
