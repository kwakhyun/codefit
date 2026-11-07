import { expect, it } from "vitest";
import type { Progress } from "../problem";
import { emptyLearning } from "./progress";
import { learningOverview, missionDomain, MISSION_SECTIONS, nextMission } from "./overview";
import { MISSIONS, missionById } from "./catalog";
import { domainFor } from "./services/domains";

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

it("next mission stays in its section and in the service domain the list was filtered by", () => {
  const first = MISSIONS[0];
  // The first recommended mission belongs to the first section shown.
  expect(first.kind).toBe(MISSION_SECTIONS[0]);
  expect(learningOverview([]).next.mission.id).toBe(first.id);
  const basics = MISSIONS.filter((m) => m.kind === "foundation");
  expect(nextMission(basics[0])?.id).toBe(basics[1].id);
  const labs = MISSIONS.filter((m) => m.kind === "lab");
  expect(nextMission(labs.at(-1)!)).toBeUndefined();
  expect(nextMission(basics.at(-1)!)).toBeUndefined();
  const coupon = missionById("shop-coupon")!;
  const commerce = nextMission(coupon, "commerce");
  expect(commerce && domainFor(commerce)).toBe("commerce");
  expect(commerce?.kind).toBe(coupon.kind);
  // A domain the mission is not in is ignored.
  expect(nextMission(basics[0], "support")?.id).toBe(basics[1].id);
  // Archived missions have no next mission.
  expect(nextMission(missionById("shop-shipping")!)).toBeUndefined();
  expect(missionDomain("work")).toBe("work");
  expect(missionDomain("unknown")).toBeUndefined();
});
