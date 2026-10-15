import { afterEach, expect, it, vi } from "vitest";
const { decide } = vi.hoisted(() => ({ decide: vi.fn() }));
vi.mock("./jev", () => ({ jevDecide: decide }));
import { buildCodeGuide } from "./jev-code-guide";
afterEach(() => decide.mockReset());
const source = [
  {
    id: "a",
    file: "auth.ts",
    code: "if(!owner) throw Error()",
    evidence: "auth.ts:L1 if(!owner) throw Error()",
  },
  { id: "b", file: "theme.ts", code: "color=blue", evidence: "theme.ts:L1 color=blue" },
];
it("returns the exact source and a controlled label, never model-written claims", async () => {
  decide.mockResolvedValue({
    value0: { type: "noul", noul: 0.95 },
    role0: { type: "choice", choice: "access", confidence: 0.9 },
    value1: { type: "noul", noul: 0.1 },
    role1: { type: "choice", choice: "unknown", confidence: 0.9 },
  });
  expect(await buildCodeGuide(source, "project", new AbortController().signal)).toEqual([
    { title: "접근 권한을 확인하는 곳", evidence: source[0].evidence },
  ]);
});
it("omits uncertain roles and preserves no-results rather than inventing recommendations", async () => {
  decide.mockResolvedValue({
    value0: { type: "noul", noul: 0.99 },
    role0: { type: "choice", choice: "access", confidence: 0.3 },
    value1: { type: "noul", noul: 0.99 },
    role1: { type: "choice", choice: "unknown", confidence: 0.9 },
  });
  expect(await buildCodeGuide(source, "project", new AbortController().signal)).toEqual([]);
});
it("continues without recommendations on provider failure", async () => {
  decide.mockResolvedValue(null);
  expect(await buildCodeGuide(source, "project", new AbortController().signal)).toEqual([]);
});
it("bounds fan-out to three requests and filters private or irrelevant fields", async () => {
  decide.mockResolvedValue(null);
  await buildCodeGuide(
    Array.from({ length: 100 }, (_, i) => ({
      ...source[0],
      id: String(i),
      file: `f${i % 8}`,
      secret: "hidden",
    })),
    "project",
    new AbortController().signal,
  );
  expect(decide).toHaveBeenCalledTimes(3);
  expect(JSON.stringify(decide.mock.calls)).not.toContain("hidden");
});
it("does not swallow user cancellation", async () => {
  decide.mockRejectedValue(new DOMException("aborted", "AbortError"));
  await expect(buildCodeGuide(source, "project", new AbortController().signal)).rejects.toThrow(
    "aborted",
  );
});

const decoding = {
  id: "decode",
  file: "codec.ts",
  code: "const parsed = JSON.parse(payload);\nreturn parsed.version === 2 ? decrypt(parsed, pin) : null;",
  evidence:
    "codec.ts:L1 const parsed = JSON.parse(payload);\ncodec.ts:L2 return parsed.version === 2 ? decrypt(parsed, pin) : null;",
};

it("rejects a confident storage label when a decoder has no persistence evidence", async () => {
  decide.mockResolvedValue({
    value0: { type: "noul", noul: 0.99 },
    role0: { type: "choice", choice: "data", confidence: 0.99 },
    persistence0: { type: "noul", noul: 0.02 },
  });
  expect(await buildCodeGuide([decoding], "project", new AbortController().signal)).toEqual([]);
  expect(decide).toHaveBeenCalledTimes(1);
});

it("keeps a storage operation that also decodes the loaded value", async () => {
  const stored = {
    id: "stored",
    file: "records.ts",
    code: "const saved = await deviceStorage.getItem(key);\nreturn saved ? JSON.parse(saved) : null;",
    evidence:
      "records.ts:L1 const saved = await deviceStorage.getItem(key);\nrecords.ts:L2 return saved ? JSON.parse(saved) : null;",
  };
  decide.mockResolvedValue({
    value0: { type: "noul", noul: 0.99 },
    role0: { type: "choice", choice: "data", confidence: 0.9 },
    persistence0: { type: "noul", noul: 0.98 },
  });
  expect(await buildCodeGuide([stored], "project", new AbortController().signal)).toEqual([
    { title: "데이터를 저장하거나 불러오는 곳", evidence: stored.evidence },
  ]);
});

it.each([undefined, { type: "noul", noul: 0.55 }, { type: "choice", choice: "data" }])(
  "omits a storage label when its independent evidence is missing or uncertain (%j)",
  async (persistence) => {
    decide.mockResolvedValue({
      value0: { type: "noul", noul: 0.99 },
      role0: { type: "choice", choice: "data", confidence: 0.99 },
      persistence0: persistence,
    });
    expect(await buildCodeGuide([decoding], "project", new AbortController().signal)).toEqual([]);
  },
);

it("does not require storage evidence for a supported processing rule", async () => {
  decide.mockResolvedValue({
    value0: { type: "noul", noul: 0.95 },
    role0: { type: "choice", choice: "business", confidence: 0.9 },
    persistence0: { type: "noul", noul: 0.01 },
  });
  expect(await buildCodeGuide([decoding], "project", new AbortController().signal)).toEqual([
    { title: "서비스의 핵심 규칙을 처리하는 곳", evidence: decoding.evidence },
  ]);
});
