import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { beforeEach, expect, it, vi } from "vitest";
type Reply = { status: number; headers: Record<string, string>; body?: string };
const { get, replies } = vi.hoisted(() => ({ get: vi.fn(), replies: new Map<string, Reply>() }));
vi.mock("node:dns/promises", () => ({
  Resolver: class {
    resolve4 = async () => ["93.184.216.34"];
    cancel() {}
  },
}));
vi.mock("node:https", () => ({ get }));
import { publicUrl, readPublicDocument } from "./project-page";

beforeEach(() => {
  replies.clear();
  get.mockReset().mockImplementation((url: URL, _options, callback) => {
    const reply = replies.get(url.href);
    if (!reply) throw new Error(`unexpected request ${url.href}`);
    const res = Object.assign(new PassThrough(), {
      statusCode: reply.status,
      headers: reply.headers,
    });
    process.nextTick(() => {
      callback(res);
      res.end(reply.body ?? "");
    });
    return new EventEmitter();
  });
});

it("keeps user input strict while allowing site-chosen query strings on redirects", () => {
  expect(() => publicUrl("https://example.com/?lang=ko")).toThrow();
  expect(publicUrl("https://example.com/?lang=ko", { allowQuery: true }).search).toBe("?lang=ko");
  expect(() => publicUrl("https://127.0.0.1/?lang=ko", { allowQuery: true })).toThrow();
});

it("follows a query redirect and inspects headers of a non-200, non-HTML final response", async () => {
  replies.set("https://example.com/", {
    status: 302,
    headers: { location: "/?lang=ko#top" },
  });
  replies.set("https://example.com/?lang=ko", {
    status: 403,
    headers: { "content-type": "application/json", "strict-transport-security": "max-age=60" },
    body: '{"challenge":true}',
  });
  const document = await readPublicDocument("https://example.com/", new AbortController().signal, {
    anyResponse: true,
  });
  expect(document).toMatchObject({
    url: "https://example.com/?lang=ko",
    status: 403,
    html: "",
    redirects: ["https://example.com/"],
  });
  expect(document.headers["strict-transport-security"]).toBe("max-age=60");
});

it("keeps the project check's 200 HTML contract and does not blame the input for redirects", async () => {
  replies.set("https://example.com/", { status: 302, headers: { location: "/?lang=ko" } });
  await expect(
    readPublicDocument("https://example.com/", new AbortController().signal),
  ).rejects.toMatchObject({ status: 422, message: expect.not.stringContaining("쿼리 문자열") });
  replies.set("https://example.com/", {
    status: 404,
    headers: { "content-type": "text/html" },
    body: "<p>missing</p>",
  });
  await expect(
    readPublicDocument("https://example.com/", new AbortController().signal),
  ).rejects.toMatchObject({ status: 422 });
});

it("still refuses redirects to insecure or internal targets on the security path", async () => {
  for (const location of [
    "http://example.com/",
    "https://example.com:8443/",
    "https://10.0.0.1/",
  ]) {
    replies.set("https://example.com/", { status: 301, headers: { location } });
    await expect(
      readPublicDocument("https://example.com/", new AbortController().signal, {
        anyResponse: true,
      }),
    ).rejects.toMatchObject({ status: 422 });
  }
});
