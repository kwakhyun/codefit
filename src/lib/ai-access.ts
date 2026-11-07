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

/**
 * Copy helpers: every screen that mentions a number reads it from AI_ACCESS so the
 * guidance cannot drift from the enforced limit. Problem generation resets at midnight
 * in Korea; every other allowance counts 24 hours from the first use.
 */
export function allowanceWindow(feature: AiFeature) {
  return feature === "generate" ? "하루" : "24시간";
}
export function guestAllowance(feature: AiFeature) {
  return AI_ACCESS.guest[feature];
}
export function memberAllowance(feature: AiFeature) {
  return AI_ACCESS.member[feature];
}
/** e.g. "24시간 기준 로그인 없이 3회, 로그인하면 5회" */
export function allowanceSummary(feature: AiFeature) {
  return `${allowanceWindow(feature)} 기준 로그인 없이 ${guestAllowance(feature)}회, 로그인하면 ${memberAllowance(feature)}회`;
}
