import { expect, it } from "vitest";
import { learningEvidence } from "./project-learning-contract";
import { eligibleSource, selectRepositoryFiles } from "./project-repository";
import { repositoryCitation, type RepositorySnapshot } from "../project-check/repository";
const repo: RepositorySnapshot = {
  name: "owner/repo",
  commit: "a".repeat(40),
  totalFiles: 1,
  eligibleFiles: 1,
  omittedFiles: 0,
  truncatedTree: false,
  links: [],
  files: [
    {
      path: "src/service.ts",
      totalLines: 2,
      partial: false,
      lines: [
        { number: 1, text: "if (previous) return previous;" },
        { number: 2, text: "return create();" },
      ],
    },
  ],
};
it("only exposes bounded server-issued citations and rejects decorated or invented references", () => {
  const c = learningEvidence(repo);
  const evidence = c.practiceSchema.shape.code.element.shape.evidence;
  expect(evidence.safeParse(["E1"]).success).toBe(true);
  for (const ref of ["E1 associated?", "src/service.ts:L1", "E9999"])
    expect(evidence.safeParse([ref]).success).toBe(false);
  const resolved = c.resolve({
    question: "중복 요청은 어떻게 되나요?",
    evidence: ["E1"],
    correctChoice: "기존 결과를 반환한다",
    distractors: ["새로 만든다"],
  });
  expect(repositoryCitation(repo, resolved.evidence[0])?.line).toBe(1);
});
it("derives the correct index from text for both learning tracks, never model numbering", () => {
  const c = learningEvidence(repo);
  for (let i = 0; i < 20; i++) {
    const correctChoice = "정의한 필수 항목과 자료형을 만족했다";
    const resolved = c.resolve({
      question: `형식 검사 통과 ${i}`,
      evidence: ["E1"],
      correctChoice,
      distractors: ["모든 세법 해석이 정확하다", "전문가 승인이 완료됐다"],
    });
    expect(resolved.choices[resolved.answer]).toBe(correctChoice);
  }
  expect(c.workshopSchema.shape.topics.element.shape).not.toHaveProperty("answer");
  expect(() =>
    c.resolve({ question: "q", evidence: ["E1"], correctChoice: "same", distractors: ["same"] }),
  ).toThrow();
  expect(() =>
    c.resolve({ question: "q", evidence: ["bad"], correctChoice: "yes", distractors: ["no"] }),
  ).toThrow();
});
it("anchors source references to readable code instead of braces or import comments", () => {
  const c = learningEvidence({
    ...repo,
    files: [
      {
        ...repo.files[0],
        totalLines: 4,
        lines: [
          { number: 1, text: "// @ts-check" },
          { number: 2, text: "import { client } from './client';" },
          { number: 3, text: "}" },
          { number: 4, text: "if (!configured) return fallback;" },
        ],
      },
    ],
  });
  expect(c.resolveEvidence("E1")).toBe("src/service.ts:L4 if (!configured) return fallback;");
});
it("prioritizes business implementations across packages over routes and generated records", () => {
  const files = [
    ...Array.from({ length: 30 }, (_, i) => ({ path: `apps/web/app/api/a${i}/route.ts` })),
    { path: "apps/web/src/lib/ai/assistant-service.ts" },
    { path: "services/payment/src/executor.ts" },
    { path: "packages/domain/src/policy.ts" },
  ];
  const selected = selectRepositoryFiles(files, 4).map((f) => f.path);
  expect(selected).toContain("apps/web/src/lib/ai/assistant-service.ts");
  expect(selected).toContain("services/payment/src/executor.ts");
  expect(selected).toContain("packages/domain/src/policy.ts");
  for (const path of [
    ".agents/skills/payment.md",
    "artifacts/live/service.yaml",
    "apps/web/.storybook/main.ts",
  ])
    expect(eligibleSource(path)).toBe(false);
});

it("keeps later modules and later branches within a shared context budget", async () => {
  const { boundRepositoryContext } = await import("./repository-context");
  const files = Array.from({ length: 16 }, (_, i) => ({
    path: `packages/module-${i}/src/very-long-path/service.ts`,
    partial: false,
    totalLines: 100,
    lines: Array.from({ length: 100 }, (_, n) => ({
      number: n + 1,
      text: "return ".padEnd(100, "x"),
    })),
  }));
  const bounded = boundRepositoryContext(files, 16000);
  expect(bounded).toHaveLength(16);
  expect(bounded.every((f) => f.lines.some((l) => l.number > 90) && f.partial)).toBe(true);
  const cost = bounded
    .flatMap((f) => f.lines.map((l) => `${f.path}:L${l.number} ${l.text}\n`))
    .join("").length;
  expect(cost).toBeLessThanOrEqual(16000);
});
