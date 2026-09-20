import { beforeEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
const { resolve4, get } = vi.hoisted(() => ({ resolve4: vi.fn(), get: vi.fn() }));
vi.mock("node:dns/promises", () => ({
  Resolver: class {
    resolve4 = resolve4;
    cancel() {}
  },
}));
vi.mock("node:https", () => ({ get }));
import { readSecurityProbe } from "./security-audit";
function reply(status: number, headers: Record<string, string>, body = "") {
  const destroy = vi.fn();
  get.mockImplementationOnce((_url, _options, callback) => {
    const request = new EventEmitter();
    queueMicrotask(() => {
      const response = Object.assign(new EventEmitter(), { statusCode: status, headers, destroy });
      callback(response);
      response.emit("data", Buffer.from(body));
      response.emit("end");
    });
    return request;
  });
  return destroy;
}
beforeEach(() => {
  resolve4.mockReset().mockResolvedValue(["93.184.216.34"]);
  get.mockReset();
});
it("rejects mixed public/private DNS before TLS and arbitrary Origin input before DNS", async () => {
  resolve4.mockResolvedValueOnce(["93.184.216.34", "10.0.0.1"]);
  await expect(
    readSecurityProbe("https://example.com", null, new AbortController().signal),
  ).rejects.toThrow();
  expect(get).not.toHaveBeenCalled();
  await expect(
    readSecurityProbe("https://example.com", "https://attacker.com", new AbortController().signal),
  ).rejects.toThrow();
  expect(resolve4).toHaveBeenCalledTimes(1);
});
it("pins DNS, does not follow redirects and discards body, cookies and unrelated headers", async () => {
  const destroy = reply(
    302,
    {
      location: "https://other.example.com",
      "set-cookie": "SECRET",
      "access-control-allow-origin": "null",
    },
    "SECRET BODY",
  );
  const result = await readSecurityProbe(
    "https://example.com/path",
    "null",
    new AbortController().signal,
  );
  expect(result).toMatchObject({
    status: 302,
    body: "",
    headers: { "access-control-allow-origin": "null" },
  });
  expect(JSON.stringify(result)).not.toContain("SECRET");
  expect(get).toHaveBeenCalledTimes(1);
  expect(destroy).toHaveBeenCalled();
  const options = get.mock.calls[0][1];
  const lookup = vi.fn();
  options.lookup("example.com", {}, lookup);
  expect(lookup).toHaveBeenCalledWith(null, "93.184.216.34", 4);
  expect(options.agent).toBe(false);
  expect(options.headers).not.toHaveProperty("Cookie");
  expect(options.headers).not.toHaveProperty("Authorization");
});
it("bounds proof bytes and reads a valid proof without persisting extra headers", async () => {
  reply(200, {}, "a".repeat(4097));
  await expect(
    readSecurityProbe(
      "https://example.com/.well-known/codefit-security.txt",
      null,
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ status: 422 });
  reply(200, { "set-cookie": "SECRET" }, "proof-token");
  expect(
    await readSecurityProbe(
      "https://example.com/.well-known/codefit-security.txt",
      null,
      new AbortController().signal,
    ),
  ).toMatchObject({ body: "proof-token" });
});
