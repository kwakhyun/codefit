import { expect, it } from "vitest";
import { emptyVerification, verificationRecordSchema, verificationStatus } from "./verification";
import { practiceSchema } from "./types";
import { fixtureVerificationRecord } from "./fixtures";
import { readBody } from "../server/http";

it("never treats legacy notes, an after-only pass, or missing evidence as verification", () => {
  expect(verificationStatus().state).toBe("not_run");
  expect(verificationStatus(emptyVerification()).state).toBe("not_run");
  expect(
    verificationStatus({ ...emptyVerification(), after: fixtureVerificationRecord.after }).state,
  ).toBe("incomplete");
  expect(verificationStatus({ ...fixtureVerificationRecord, command: " " }).state).toBe(
    "incomplete",
  );
  for (const stage of ["before", "after", "reverted"] as const) {
    expect(
      verificationStatus({
        ...fixtureVerificationRecord,
        [stage]: { ...fixtureVerificationRecord[stage], evidence: " " },
      }).state,
    ).toBe("incomplete");
  }
});

it("distinguishes broken fixes and tests that cannot discriminate the defect", () => {
  expect(
    verificationStatus({
      ...fixtureVerificationRecord,
      after: { outcome: "failed", evidence: "same failure" },
    }).state,
  ).toBe("failed");
  for (const stage of ["before", "reverted"] as const)
    expect(
      verificationStatus({
        ...fixtureVerificationRecord,
        [stage]: { outcome: "passed", evidence: "no failure" },
      }).state,
    ).toBe("inconclusive");
  const status = verificationStatus(fixtureVerificationRecord);
  expect(status.state).toBe("recorded");
  expect(status.label).toContain("자기 기록");
  expect(status.detail).toContain("검증한 것은 아닙니다");
});

it("keeps partial drafts saveable but rejects unsupported outcomes and oversized evidence", () => {
  expect(
    verificationRecordSchema.safeParse({
      ...emptyVerification(),
      after: { outcome: "passed", evidence: "" },
    }).success,
  ).toBe(true);
  expect(
    verificationRecordSchema.safeParse({
      ...fixtureVerificationRecord,
      after: { outcome: "verified", evidence: "" },
    }).success,
  ).toBe(false);
  expect(
    verificationRecordSchema.safeParse({
      ...fixtureVerificationRecord,
      after: { outcome: "passed", evidence: "x".repeat(601) },
    }).success,
  ).toBe(false);
});

it("accepts bounded multibyte practice records and legacy tasks", async () => {
  const tasks = Array.from({ length: 5 }, (_, questionIndex) => ({
    questionIndex,
    status: "planned",
    result: "가".repeat(4000),
  }));
  expect(practiceSchema.safeParse({ revision: 0, tasks }).success).toBe(true);
  const run = { outcome: "failed", evidence: "가".repeat(600) };
  const body = JSON.stringify({
    revision: 0,
    tasks: tasks.map((task) => ({
      ...task,
      verification: { command: "가".repeat(300), before: run, after: run, reverted: run },
    })),
  });
  expect(Buffer.byteLength(body)).toBeGreaterThan(80_000);
  const value = await readBody(
    new Request("https://example.com/", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body,
    }),
    practiceSchema,
    128_000,
  );
  expect(value.tasks[4].verification?.after.evidence).toHaveLength(600);
});
