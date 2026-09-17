export function aiModel(operation: "generate" | "review" | "guide" | "project") {
  if (operation === "project") return process.env.OPENAI_PROJECT_MODEL || "gpt-5.6-sol";
  if (operation === "guide") return process.env.OPENAI_GUIDE_MODEL || "gpt-5.6-luna";
  return operation === "generate"
    ? process.env.OPENAI_GENERATION_MODEL || "gpt-5.6-sol"
    : process.env.OPENAI_REVIEW_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-luna";
}
