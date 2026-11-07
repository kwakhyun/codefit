import { describe, expect, it } from "vitest";
import { AI_LESSONS } from "./catalog";
import { AI_CONTENT, correctQuizIndex } from "./content";
import { MISSIONS, isArchivedMission, missionById } from "../learn/catalog";

/**
 * The correct choice must not give itself away by being clearly the longest. Allows about 15%
 * so wording can stay natural, and fails when one question is answerable by length alone.
 */
const MAX_RATIO = 1.15;
const length = (text: string) => [...text].length;
function lengthRatio(choices: string[], answer: number) {
  const others = choices.filter((_, index) => index !== answer).map(length);
  return length(choices[answer]) / Math.max(...others);
}
const ARCHIVED = [
  "lists-and-filters",
  "shop-shipping",
  "booking-cancel",
  "booking-guests",
  "work-budget",
  "work-dependency",
  "content-segment",
  "support-close",
];

describe("answer choices are balanced", () => {
  it("AI lesson quizzes", () => {
    const failures = AI_LESSONS.map((lesson) => {
      const quiz = AI_CONTENT[lesson.id].quiz;
      const ratio = lengthRatio(
        quiz.choices.map((choice) => choice.text),
        correctQuizIndex(quiz),
      );
      return { id: lesson.id, ratio };
    }).filter((item) => item.ratio > MAX_RATIO);
    expect(failures).toEqual([]);
  });
  it("mission transfer questions, including archived missions", () => {
    expect(ARCHIVED.every(isArchivedMission)).toBe(true);
    const missions = [...MISSIONS, ...ARCHIVED.map((id) => missionById(id)!)];
    const failures = missions
      .map((mission) => ({
        id: mission.id,
        ratio: lengthRatio(mission.transfer.choices, mission.transfer.answer),
      }))
      .filter((item) => item.ratio > MAX_RATIO);
    expect(failures).toEqual([]);
  });
  it("the correct choice is not usually the single longest one", () => {
    const quizzes = AI_LESSONS.map((lesson) => AI_CONTENT[lesson.id].quiz);
    const longest = quizzes.filter(
      (quiz) =>
        lengthRatio(
          quiz.choices.map((c) => c.text),
          correctQuizIndex(quiz),
        ) > 1,
    );
    // Close to chance (one in the number of choices), not a pattern to learn.
    expect(longest.length).toBeLessThanOrEqual(Math.ceil(quizzes.length / 2));
    const positions = new Set(quizzes.map(correctQuizIndex));
    expect(positions.size).toBeGreaterThanOrEqual(3);
  });
});
