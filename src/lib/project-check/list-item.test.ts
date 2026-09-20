import { expect, it } from "vitest";
import { checkListItem } from "./types";
import { fixtureCheck, fixtureAssessment } from "./fixtures";
import { publicCheck } from "../server/project-check-store";
it("keeps history responses compact without source, answers, or assessment prose", () => {
  const check = {
    ...publicCheck(fixtureCheck),
    description: "private draft",
    review: { answers: Array(5).fill("long answer".repeat(100)), assessment: fixtureAssessment },
  };
  const row = checkListItem(check);
  expect(row).toEqual({
    id: check.id,
    createdAt: check.createdAt,
    page: { url: check.page.url },
    analysis: { title: check.analysis.title },
    review: { assessment: { score: fixtureAssessment.score } },
  });
  expect(JSON.stringify(row).length).toBeLessThan(600);
  expect(row).not.toHaveProperty("description");
  expect(row.page).not.toHaveProperty("repository");
});
