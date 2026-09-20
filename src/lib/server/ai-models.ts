/** Generation quality floor: only explicitly supported Sol-or-higher models. */
function generationModel(configured: string | undefined) {
  return configured && /^(gpt-5\.6-sol|gpt-6-astra)(-\d{4}-\d{2}-\d{2})?$/.test(configured)
    ? configured
    : "gpt-5.6-sol";
}
export function aiModel(operation: "generate" | "review" | "guide" | "project") {
  if (operation === "project") return generationModel(process.env.OPENAI_PROJECT_MODEL);
  if (operation === "guide") return process.env.OPENAI_GUIDE_MODEL || "gpt-5.6-luna";
  return operation === "generate"
    ? generationModel(process.env.OPENAI_GENERATION_MODEL)
    : process.env.OPENAI_REVIEW_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-luna";
}
