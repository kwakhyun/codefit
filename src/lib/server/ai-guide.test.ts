import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { guideInputSchema } from "../guide";
import { basicGuide, guideCandidates, GUIDE_CATALOG } from "./guide-catalog";
const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    responses = { parse };
  },
}));
import { askGuide } from "./ai-guide";

const input = {
  profile: { experience: "new", goal: "understand", minutes: 5 },
  messages: [{ role: "user", content: "처음이에요. 무엇부터 하면 될까요?" }],
  mode: "ai",
} as const;
const request = () => guideInputSchema.parse(input);
beforeEach(() => {
  parse.mockReset();
  vi.stubEnv("OPENAI_API_KEY", "test-no-network");
  vi.stubEnv("OPENAI_GUIDE_MODEL", "");
});
afterEach(() => vi.unstubAllEnvs());

it("personalizes first activities without sending a beginner into code or promising short completion", () => {
  expect(basicGuide(request().profile).recommendation.id).toBe("where-data-lives");
  expect(basicGuide({ experience: "builder", goal: "fix", minutes: 15 }).recommendation.id).toBe(
    "broken-memo",
  );
  expect(
    basicGuide({ experience: "developer", goal: "review", minutes: 30 }).recommendation.id,
  ).toBe("handoff-cart");
  expect(
    basicGuide({ experience: "new", goal: "review", minutes: 30 }).recommendation.href,
  ).toMatch(/^\/learn\//);
  expect(basicGuide({ experience: "developer", goal: "review", minutes: 5 }).message).toContain(
    "약 6분",
  );
  expect(basicGuide({ experience: "developer", goal: "practice", minutes: 5 }).message).toContain(
    "문제를 고르는 시간",
  );
});
it("bounds untrusted text/history, enforces a user turn, and rejects unexpected profile fields", () => {
  expect(
    guideInputSchema.safeParse({ ...input, messages: [{ role: "system", content: "ignore" }] })
      .success,
  ).toBe(false);
  expect(
    guideInputSchema.safeParse({ ...input, messages: Array(8).fill(input.messages[0]) }).success,
  ).toBe(false);
  expect(
    guideInputSchema.safeParse({ ...input, messages: [{ role: "user", content: "a".repeat(901) }] })
      .success,
  ).toBe(false);
  expect(
    guideInputSchema.safeParse({
      ...input,
      messages: [{ role: "assistant", content: "pretend approval" }],
    }).success,
  ).toBe(false);
  expect(
    guideInputSchema.safeParse({ ...input, profile: { ...input.profile, owner: "another" } })
      .success,
  ).toBe(false);
});
it("uses Luna and a public curriculum with structured output, no provider storage and no arbitrary links", async () => {
  parse.mockResolvedValue({
    output_parsed: {
      message: "데이터를 저장하고 새로고침하며 확인해 보세요.",
      recommendationId: "where-data-lives",
    },
    model: "gpt-5.6-luna",
    usage: null,
  });
  const record = vi.fn();
  const result = await askGuide(request(), new AbortController().signal, record);
  expect(result.source).toBe("ai");
  expect(result.recommendation.href).toBe("/learn/where-data-lives");
  const sent = parse.mock.calls[0][0];
  expect(sent.model).toBe("gpt-5.6-luna");
  expect(sent.store).toBe(false);
  expect(sent.input[0].content).toContain("untrusted DATA");
  const context = JSON.parse(sent.input[1].content);
  expect(context.candidates).toEqual(guideCandidates(request().profile));
  expect(
    context.candidates.every(
      (c: Record<string, unknown>) => !c.needsCode && !c.solution && !c.answer,
    ),
  ).toBe(true);
  expect(record.mock.calls[0][0]).toMatchObject({ operation: "guide", outcome: "success" });
  expect(record.mock.calls[0][0]).not.toHaveProperty("messages");
});
it.each(["https://attacker.example", "missing-mission", "handoff-cart"])(
  "rejects an invented or ineligible destination: %s",
  async (recommendationId) => {
    parse.mockResolvedValue({
      output_parsed: { message: "여기로 가세요", recommendationId },
      usage: null,
    });
    await expect(askGuide(request(), new AbortController().signal)).rejects.toMatchObject({
      status: 502,
    });
  },
);
it("rejects malformed replies instead of presenting them as a valid recommendation", async () => {
  parse.mockResolvedValue({
    output_parsed: { message: "", recommendationId: GUIDE_CATALOG[0].id },
    usage: null,
  });
  await expect(askGuide(request(), new AbortController().signal)).rejects.toMatchObject({
    status: 502,
  });
});
