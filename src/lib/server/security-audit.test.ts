import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  createOwnershipChallenge,
  validateOwnershipToken,
  runCorsAudit,
  interpretCors,
} from "./security-audit";
import { corsAuditText, type ProbeEvidence } from "../security-audit";
beforeEach(() =>
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-security-check-12345678901234567890"),
);
afterEach(() => vi.unstubAllEnvs());
it("binds proof to owner, exact origin, expiry and a tamper-evident signature", () => {
  const proof = createOwnershipChallenge("https://example.com/read", "alice", 1000);
  expect(validateOwnershipToken(proof.token, "https://example.com/other", "alice", 2000)).toBe(
    "https://example.com/.well-known/codefit-security.txt",
  );
  for (const [token, url, owner, now] of [
    [proof.token, "https://example.com/", "bob", 2000],
    [proof.token, "https://sub.example.com/", "alice", 2000],
    [proof.token, "https://example.com/", "alice", 3601000],
    [proof.token.slice(0, -5) + "wrong", "https://example.com/", "alice", 2000],
  ] as const)
    expect(() => validateOwnershipToken(token, url, owner, now)).toThrow();
});
it("rejects invalid proof without sending any probe; never follows ownership redirects", async () => {
  const proof = createOwnershipChallenge("https://example.com/", "alice");
  const read = vi.fn().mockResolvedValue({ status: 302, body: proof.token, headers: {} });
  await expect(
    runCorsAudit("https://example.com/", "bob", proof.token, new AbortController().signal, read),
  ).rejects.toMatchObject({ status: 403 });
  expect(read).not.toHaveBeenCalled();
  await expect(
    runCorsAudit("https://example.com/", "alice", proof.token, new AbortController().signal, read),
  ).rejects.toMatchObject({ status: 403 });
  expect(read).toHaveBeenCalledTimes(1);
});
it("rechecks ownership and sends exactly three bounded same-target probes, without exporting body secrets", async () => {
  const proof = createOwnershipChallenge("https://example.com/read", "alice");
  const read = vi.fn().mockImplementation(async (url: string, origin: string | null) => ({
    status: 200,
    body: url.endsWith("codefit-security.txt") ? proof.token : "SECRET BODY",
    headers: {
      "access-control-allow-origin": origin || "",
      "access-control-allow-credentials": "true",
      "set-cookie": "SECRET COOKIE",
    },
  }));
  const result = await runCorsAudit(
    "https://example.com/read",
    "alice",
    proof.token,
    new AbortController().signal,
    read,
  );
  expect(read).toHaveBeenCalledTimes(4);
  expect(read.mock.calls.slice(1).every(([url]) => url === "https://example.com/read")).toBe(true);
  expect(result.status).toBe("review");
  expect(JSON.stringify(result)).not.toContain("SECRET");
  expect(corsAuditText(result)).toContain("데이터 유출");
});
it("does not call wildcard credential CORS an exploit and treats redirects as inconclusive", () => {
  const evidence: ProbeEvidence[] = [null, "https://probe.invalid", "null"].map((origin) => ({
    label: "request",
    origin,
    status: 200,
    allowOrigin: "*",
    allowCredentials: "true",
    vary: "",
  }));
  expect(interpretCors("https://example.com/", evidence).status).toBe("observed");
  expect(
    interpretCors(
      "https://example.com/",
      evidence.map((e) => ({ ...e, status: 302 })),
    ).status,
  ).toBe("unknown");
});
it("fails closed when the signing secret is unavailable", () => {
  vi.stubEnv("BETTER_AUTH_SECRET", "");
  expect(() => createOwnershipChallenge("https://example.com/", "alice")).toThrow();
});
