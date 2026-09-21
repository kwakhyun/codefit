/** Product allowances. Identity is resolved server-side; clients only display these values. */
const AI_ACCESS = {
  guest: {
    generate: 2,
    review: 2,
    coach: 2,
    learnCoach: 2,
    guide: 2,
    analysis: 3,
    projectReview: 2,
  },
  member: {
    generate: 6,
    review: 30,
    coach: 30,
    learnCoach: 30,
    guide: 20,
    analysis: 5,
    projectReview: 12,
  },
} as const;
export type AiFeature = keyof typeof AI_ACCESS.guest;
export function allowanceFor(owner: string) {
  return owner.startsWith("user:") ? AI_ACCESS.member : AI_ACCESS.guest;
}
