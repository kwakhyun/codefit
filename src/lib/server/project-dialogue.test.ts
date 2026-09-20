import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("./ai-project-check", () => ({
  analyzeProject: vi.fn(),
  assessProject: vi.fn(),
  discussProjectCode: vi.fn(),
}));
import { discussProjectCode } from "./ai-project-check";
import { SqliteStore } from "./sqlite-store";
import { ProjectCheckService } from "./project-check-service";
import { fixtureCheck } from "../project-check/fixtures";
let store: SqliteStore;
const checkId = randomUUID();
const reply = {
  alignment: "uncertain" as const,
  explanation: "실행 결과는 확인이 필요합니다.",
  codeEvidence: "main.py:L1 return True",
  nextQuestion: "실패하면 어떻게 확인하나요?",
  nextAction: "로컬에서 실패를 재현해 보세요.",
};
beforeEach(async () => {
  store = new SqliteStore(":memory:");
  const claim = await store.startJob("user:a", checkId, "project-analysis", "source");
  if (claim.state !== "new") throw Error("lease");
  await store.queries.projectChecks.complete(claim.lease, {
    ...fixtureCheck,
    id: checkId,
    page: {
      ...fixtureCheck.page,
      source: "repository",
      repository: {
        name: "owner/repo",
        commit: "a".repeat(40),
        files: [
          {
            path: "main.py",
            totalLines: 1,
            partial: false,
            lines: [{ number: 1, text: "return True" }],
          },
        ],
        links: [],
        eligibleFiles: 0,
        totalFiles: 0,
        truncatedTree: false,
        omittedFiles: 0,
      },
    },
  });
  vi.mocked(discussProjectCode).mockReset().mockResolvedValue(reply);
});
afterEach(() => store.db.close());
it("stores adaptive replies, replays retries and never accepts another owner’s previous turn", async () => {
  const service = new ProjectCheckService(store),
    signal = AbortSignal.timeout(5000),
    input = { questionIndex: 0, answer: "실패도 성공으로 간주합니다." };
  const one = await service.discuss("user:a", "network", checkId, input, signal);
  expect(await service.discuss("user:a", "network", checkId, input, signal)).toEqual(one);
  expect(discussProjectCode).toHaveBeenCalledTimes(1);
  expect(await store.queries.projectChecks.dialogue("user:b", checkId, 0)).toBeNull();
  await expect(service.discuss("user:b", "network", checkId, input, signal)).rejects.toMatchObject({
    status: 404,
  });
  await expect(
    service.discuss(
      "user:a",
      "network",
      checkId,
      { ...input, questionIndex: 1, previousId: one.id },
      signal,
    ),
  ).rejects.toMatchObject({ status: 409 });
  const two = await service.discuss(
    "user:a",
    "network",
    checkId,
    { ...input, answer: "실패를 구분하도록 고치겠습니다.", previousId: one.id },
    signal,
  );
  expect(two.turns).toHaveLength(2);
  expect(vi.mocked(discussProjectCode).mock.calls[1][3]).toEqual(one);
  expect(await store.queries.projectChecks.dialogue("user:a", checkId, 0)).toEqual(two);
  expect((await store.queries.projectChecks.usage("user:a")).review.remaining).toBe(10);
  const three = await service.discuss(
    "user:a",
    "network",
    checkId,
    { ...input, previousId: two.id },
    signal,
  );
  await expect(
    service.discuss("user:a", "network", checkId, { ...input, previousId: three.id }, signal),
  ).rejects.toMatchObject({ status: 409 });
  const backup = store.exportBackup("user:a");
  store.importBackup("user:restored", backup);
  const restored = (await store.queries.projectChecks.list("user:restored"))[0];
  const restoredDialogue = await store.queries.projectChecks.dialogue(
    "user:restored",
    restored.id,
    0,
  );
  expect(restoredDialogue?.turns).toHaveLength(3);
  expect(restoredDialogue?.id).toBe(`${restored.id}:dialogue:0:2`);
  expect(restored.page.repository?.files[0].path).toBe("main.py");
  await store.queries.projectChecks.remove("user:a", checkId);
  expect(await store.queries.projectChecks.dialogue("user:a", checkId, 0)).toBeNull();
});
it("does not resurrect a dialogue if its project is deleted during generation", async () => {
  vi.mocked(discussProjectCode).mockImplementation(async () => {
    await store.queries.projectChecks.remove("user:a", checkId);
    return reply;
  });
  await expect(
    new ProjectCheckService(store).discuss(
      "user:a",
      "network",
      checkId,
      { questionIndex: 0, answer: "설명" },
      AbortSignal.timeout(5000),
    ),
  ).rejects.toThrow();
  expect(await store.queries.projectChecks.dialogue("user:a", checkId, 0)).toBeNull();
});
