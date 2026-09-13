export function aiModel(operation: "generate" | "review") {
  return operation === "generate"
    ? process.env.OPENAI_GENERATION_MODEL || "gpt-5.6-sol"
    : process.env.OPENAI_REVIEW_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini";
}
