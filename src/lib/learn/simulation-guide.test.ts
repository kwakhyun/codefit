import { describe, expect, it } from "vitest";
import { MISSIONS, missionById, isArchivedMission } from "./catalog";
import { experimentProgress, experimentSteps } from "./simulation-guide";
import { projectExperiment } from "./project-experiment";
import { reproduced } from "./simulation";
import { emptyLearning, validLearning } from "./progress";

describe("experiment guidance", () => {
  for (const mission of MISSIONS) {
    it(`${mission.id}: guided actions reproduce the defect before optional experiments`, () => {
      expect(projectExperiment(mission)).toBeTruthy();
      const steps = experimentSteps(mission);
      expect(
        steps.every(
          (step) => mission.actions.includes(step.action) && step.purpose && step.observe,
        ),
      ).toBe(true);
      const required = steps.filter((step) => !step.optional).map((step) => step.action);
      expect(reproduced(mission, required)).toBe(true);
      const actions = steps.map((step) => step.action);
      for (let i = 0; i <= steps.length; i++)
        expect(experimentProgress(mission, actions.slice(0, i))).toBe(i);
    });
  }
  it("does not count processing a different case as observing the requested case", () => {
    const m = missionById("shop-coupon")!;
    expect(experimentProgress(m, ["case-edge", "case-standard", "case-submit"])).toBe(0);
    expect(experimentProgress(m, ["case-edge", "case-standard", "case-submit", "case-edge"])).toBe(
      1,
    );
    expect(
      experimentProgress(m, [
        "case-edge",
        "case-standard",
        "case-submit",
        "case-edge",
        "case-submit",
      ]),
    ).toBe(2);
  });
  it("retains old routes and records without recommending archived lessons", () => {
    for (const id of [
      "lists-and-filters",
      "shop-shipping",
      "booking-cancel",
      "booking-guests",
      "work-budget",
      "work-dependency",
      "content-segment",
      "support-close",
    ]) {
      expect(isArchivedMission(id)).toBe(true);
      expect(MISSIONS.some((m) => m.id === id)).toBe(false);
      const mission = missionById(id)!;
      expect(validLearning(mission, { ...emptyLearning(), actions: mission.reproduce })).toBe(true);
    }
  });
});
