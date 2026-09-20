import { afterEach, expect, it, vi } from "vitest";
import { aiModel } from "./ai-models";
afterEach(() => vi.unstubAllEnvs());
it("keeps a Sol generation floor and allows explicitly supported higher models", () => {
  for (const name of ["", "gpt-5.6-luna", "gpt-5.6-terra", "unknown-model"]) {
    vi.stubEnv("OPENAI_PROJECT_MODEL", name);
    vi.stubEnv("OPENAI_GENERATION_MODEL", name);
    expect(aiModel("project")).toBe("gpt-5.6-sol");
    expect(aiModel("generate")).toBe("gpt-5.6-sol");
  }
  vi.stubEnv("OPENAI_PROJECT_MODEL", "gpt-6-astra");
  expect(aiModel("project")).toBe("gpt-6-astra");
  vi.stubEnv("OPENAI_PROJECT_REVIEW_MODEL", "gpt-5.6-luna");
  vi.stubEnv("OPENAI_REVIEW_MODEL", "gpt-5.6-luna");
  expect(aiModel("review")).toBe("gpt-5.6-luna");
});
