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
it("preserves the full cited block including the actual decision after imports", () => {
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
  expect(c.resolveEvidence("E1")).toContain("src/service.ts:L4 if (!configured) return fallback;");
  expect(
    repositoryCitation(
      {
        ...repo,
        files: [
          {
            ...repo.files[0],
            lines: [
              { number: 1, text: "a" },
              { number: 2, text: "b" },
            ],
          },
        ],
      },
      "src/service.ts:L1 a\nsrc/service.ts:L2 b",
    ),
  ).toMatchObject({ line: 1, endLine: 2 });
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

it("selects runtime Python modules before package initializers, setup and tests", () => {
  const candidates = [
    ...Array.from({ length: 8 }, (_, i) => ({ path: `sensor_${i}/sensor_${i}/__init__.py` })),
    ...Array.from({ length: 8 }, (_, i) => ({ path: `sensor_${i}/setup.py` })),
    { path: "sensor/test/test_reliability.py" },
    { path: "sensor/sensor/reliability_node.py" },
    { path: "api/app/transcription.py" },
    { path: "api/app/service.py" },
  ];
  expect(
    selectRepositoryFiles(candidates, 3)
      .map((f) => f.path)
      .sort(),
  ).toEqual([
    "api/app/service.py",
    "api/app/transcription.py",
    "sensor/sensor/reliability_node.py",
  ]);
});

it("accepts shell and executable extensionless source without opening binary or private paths", () => {
  for (const file of ["config/lib/session.sh", "bin/workspace", "scripts/run.bash"])
    expect(eligibleSource(file)).toBe(true);
  expect(eligibleSource("launch", "100755")).toBe(true);
  expect(eligibleSource("launch", "100644")).toBe(false);
  for (const file of ["bin/tool.png", ".git/bin/run", "bin/.env", "bin/private.key", "../bin/run"])
    expect(eligibleSource(file, "100755")).toBe(false);
});

it("keeps the full cited range and rejects missing or reordered lines", () => {
  const evidence =
    "src/service.ts:L1 if (previous) return previous;\nsrc/service.ts:L2 return create();";
  expect(repositoryCitation(repo, evidence)).toMatchObject({
    line: 1,
    endLine: 2,
    url: expect.stringContaining("#L1-L2"),
  });
  expect(repositoryCitation(repo, evidence.replace("L2", "L3"))).toBeUndefined();
  expect(repositoryCitation(repo, evidence.split("\n").reverse().join("\n"))).toBeUndefined();
});

it("keeps all later decision blocks within each citation's storage limit", () => {
  const file = {
    path: "src/flow.py",
    totalLines: 700,
    partial: false,
    lines: Array.from({ length: 700 }, (_, i) => ({
      number: i + 1,
      text: `if condition_${i}: return ${i}`,
    })),
  };
  const source = { ...repo, files: [file] };
  const contract = learningEvidence(source);
  expect(contract.snippets.some((s) => s.code.includes("condition_699"))).toBe(true);
  for (const snippet of contract.snippets) {
    const evidence = contract.resolveEvidence(snippet.id);
    expect(evidence.length).toBeLessThanOrEqual(1100);
    expect(repositoryCitation(source, evidence)).toBeDefined();
  }
});

it("follows Python implementation imports without selecting decorative JS dependencies", async () => {
  const { dependencyCandidates, extractSource } = await import("./project-repository");
  const files = [
    extractSource(
      "api/app/main.py",
      "from .service import handle\nfrom app.transcription import transcribe",
    ),
    extractSource("src/App.tsx", "import {Orb} from './components/Orb';"),
  ];
  const candidates = [
    "api/app/service.py",
    "api/app/transcription.py",
    "src/components/Orb.tsx",
  ].map((path) => ({ path }));
  expect(dependencyCandidates(files, candidates).map((f) => f.path)).toEqual([
    "api/app/service.py",
    "api/app/transcription.py",
  ]);
});

it("links GitLab ranges using its permalink syntax and keeps trailing blank lines valid", () => {
  const source = {
    ...repo,
    url: "https://gitlab.com/owner/repo",
    files: [
      {
        ...repo.files[0],
        lines: [
          { number: 1, text: "return existing;" },
          { number: 2, text: "" },
        ],
      },
    ],
  };
  const contract = learningEvidence(source);
  const evidence = contract.resolveEvidence("E1").trim();
  expect(repositoryCitation(source, evidence)).toMatchObject({
    line: 1,
    endLine: 2,
    url: expect.stringContaining("#L1-2"),
  });
});

it("includes a referenced literal constant outside the decision window without unrelated declarations", async () => {
  const { repositoryEvidenceContext } = await import("../project-check/repository");
  const file = {
    path: "grade.py",
    totalLines: 50,
    partial: true,
    lines: [
      { number: 1, text: "MERGE_GAP = 10" },
      { number: 2, text: "UNUSED_LIMIT = 99" },
      { number: 3, text: "DYNAMIC_VALUE = calculate()" },
      { number: 30, text: "if start <= end + MERGE_GAP:" },
      { number: 31, text: "    return DYNAMIC_VALUE" },
    ],
  };
  expect(repositoryEvidenceContext(file, [{ line: 30, endLine: 31 }]).map((l) => l.number)).toEqual(
    [1, 30, 31],
  );
});

it("collects Dart business flows before evaluation, e2e and configuration files", () => {
  const paths = [
    "hosting/public/eval/spa/app.js",
    "e2e/support/profile-worker.ts",
    "contracts/worker-configuration.ts",
    "lib/main.dart",
    "lib/services/invitation_parser.dart",
    "lib/repositories/event_repository.dart",
  ];
  expect(paths.slice(3).every((p) => eligibleSource(p))).toBe(true);
  expect(
    selectRepositoryFiles(
      paths.map((path) => ({ path })),
      3,
    )
      .map((f) => f.path)
      .sort(),
  ).toEqual(paths.slice(3).sort());
});

it("overlaps a guard and the return value across citation boundaries", () => {
  const lines = Array.from({ length: 14 }, (_, i) => ({
    number: i + 1,
    text:
      i === 11
        ? "if invalid: return None"
        : i === 12
          ? "return {'translation_status': 'pending'}"
          : "# context",
  }));
  const snapshot = { ...repo, files: [{ ...repo.files[0], lines, totalLines: 14 }] };
  const contract = learningEvidence(snapshot);
  const citation = contract.resolveEvidence("E1");
  expect(citation).toContain("translation_status");
  expect(repositoryCitation(snapshot, citation)).not.toBeNull();
});

it("cleans internal labels including Korean particles without changing evidence or code identifiers", () => {
  const c = learningEvidence(repo);
  const value = c.cleanText({
    summary: "E1은 조건을 검사합니다(E1). E1에서 반환합니다.",
    evidence: ["E1"],
    other: "CODE1 E400",
  });
  expect(value.summary).toBe("인용한 코드는 조건을 검사합니다. 인용한 코드에서 반환합니다.");
  expect(value.evidence).toEqual(["E1"]);
  expect(value.other).toBe("CODE1 E400");
});

it("follows Dart relative and package imports to local runtime files", async () => {
  const { dependencyCandidates } = await import("./project-repository");
  const files = [
    {
      ...repo.files[0],
      path: "lib/main.dart",
      lines: [
        { number: 1, text: "import 'services/parser.dart';" },
        { number: 2, text: "import 'package:app/repositories/events.dart';" },
      ],
    },
  ];
  expect(
    dependencyCandidates(files, [
      { path: "lib/services/parser.dart" },
      { path: "lib/repositories/events.dart" },
      { path: "lib/unused.dart" },
    ]),
  ).toHaveLength(2);
});

it("prefers Dart use cases and persistence over analytics and generated models", () => {
  const candidates = [
    "lib/core/analytics/analytics_service.dart",
    "lib/data/models/account/account_model.dart",
    "lib/data/models/account/account.g.dart",
    "lib/domain/usecases/analyze_link_usecase.dart",
    "lib/data/repositories/schedule_repository.dart",
    "lib/data/sources/remote/firebase_ai_logic_impl.dart",
  ];
  expect(
    selectRepositoryFiles(
      candidates.map((path) => ({ path })),
      3,
    )
      .map((f) => f.path)
      .sort(),
  ).toEqual(candidates.slice(3).sort());
});

it("keeps a return visible when long leading context exhausts a citation budget", () => {
  const lines = Array.from({ length: 18 }, (_, i) => ({
    number: i + 1,
    text:
      i === 14
        ? "if invalid: return None"
        : i === 15
          ? "return {'translation_status': 'pending'}"
          : "# " + "context ".repeat(9),
  }));
  const c = learningEvidence({
    ...repo,
    files: [{ ...repo.files[0], lines, totalLines: lines.length }],
  });
  for (const s of c.snippets.filter((s) => s.code.includes("if invalid"))) {
    expect(s.code).toContain("translation_status");
    expect(c.resolveEvidence(s.id).length).toBeLessThanOrEqual(1100);
  }
});
