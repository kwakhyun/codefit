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
import { readPublicPage } from "./project-page";
function reply(status: number, headers: Record<string, string>, html = "") {
  get.mockImplementationOnce((_url, _options, callback) => {
    const request = new EventEmitter();
    queueMicrotask(() => {
      const response = Object.assign(new EventEmitter(), {
        statusCode: status,
        headers,
        destroy: vi.fn(),
      });
      callback(response);
      response.emit("data", Buffer.from(html));
      response.emit("end");
    });
    return request;
  });
}
beforeEach(() => {
  resolve4.mockReset().mockResolvedValue(["93.184.216.34"]);
  get.mockReset();
});
it("pins validated DNS, sends no credentials, follows only revalidated redirects, and never fetches subresources", async () => {
  reply(302, { location: "https://other.example.com/" });
  reply(
    200,
    { "content-type": "text/html" },
    "<title>예약</title><p>회의실 예약</p><img src='/private'>",
  );
  const result = await readPublicPage("https://example.com/", new AbortController().signal);
  expect(result.url).toBe("https://other.example.com/");
  expect(resolve4).toHaveBeenCalledTimes(2);
  expect(get).toHaveBeenCalledTimes(2);
  const options = get.mock.calls[0][1];
  const lookup = vi.fn();
  options.lookup("example.com", {}, lookup);
  expect(lookup).toHaveBeenCalledWith(null, "93.184.216.34", 4);
  expect(options.family).toBe(4);
  expect(options.agent).toBe(false);
  expect(options.headers.Cookie).toBeUndefined();
  expect(options.headers.Authorization).toBeUndefined();
});
it("blocks private DNS and redirects into metadata endpoints before connecting", async () => {
  resolve4.mockResolvedValueOnce(["10.0.0.1"]);
  await expect(
    readPublicPage("https://example.com/", new AbortController().signal),
  ).rejects.toThrow();
  expect(get).not.toHaveBeenCalled();
  reply(302, { location: "https://169.254.169.254/" });
  await expect(
    readPublicPage("https://example.com/", new AbortController().signal),
  ).rejects.toThrow();
  expect(get).toHaveBeenCalledTimes(1);
});
it("rejects oversized and unsupported responses", async () => {
  reply(200, { "content-type": "text/html" }, "a".repeat(600001));
  await expect(
    readPublicPage("https://example.com/", new AbortController().signal),
  ).rejects.toMatchObject({ status: 422 });
  reply(200, { "content-type": "application/json" }, "{}");
  await expect(
    readPublicPage("https://example.com/", new AbortController().signal),
  ).rejects.toMatchObject({ status: 422 });
});
