import { beforeEach, expect, it, vi } from "vitest";
const { session, consume, refund, read } = vi.hoisted(() => ({
  session: vi.fn(),
  consume: vi.fn(),
  refund: vi.fn(),
  read: vi.fn(),
}));
vi.mock("./session", () => ({ session }));
vi.mock("./database", () => ({
  getStore: async () => ({ consumeLimits: consume, queries: { refundLimits: refund } }),
}));
vi.mock("./project-page", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./project-page")>()),
  readPublicDocument: read,
}));
import { POST } from "@/app/api/security-check/route";
import { HttpError } from "./http";
function request(body: unknown) {
  return new Request("https://codefit.test/api/security-check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({ owner: "guest" });
  consume.mockResolvedValue(true);
  refund.mockResolvedValue(undefined);
  read.mockResolvedValue({
    url: "https://example.com/",
    html: "",
    headers: {},
    fetchedAt: new Date().toISOString(),
  });
});
it("rejects unauthorized inputs and internal URLs before fetching", async () => {
  expect((await POST(request({ url: "https://example.com/", authorized: false }))).status).toBe(
    400,
  );
  expect((await POST(request({ url: "https://127.0.0.1/", authorized: true }))).status).toBe(400);
  expect(read).not.toHaveBeenCalled();
});
it("enforces budgets before any target request", async () => {
  consume.mockResolvedValue(false);
  expect((await POST(request({ url: "https://example.com/", authorized: true }))).status).toBe(429);
  expect(read).not.toHaveBeenCalled();
});
it("returns bounded observations with no raw HTML or cookies", async () => {
  const result = await POST(request({ url: "https://example.com/", authorized: true }));
  expect(result.status).toBe(200);
  const body = await result.json();
  expect(body.findings).toHaveLength(6);
  expect(body.html).toBeUndefined();
  expect(consume.mock.calls[0][0]).toHaveLength(4);
  // Header analysis accepts any final status or content type on this path only.
  expect(read).toHaveBeenCalledWith("https://example.com/", expect.anything(), {
    anyResponse: true,
  });
  expect(refund).not.toHaveBeenCalled();
});
it("returns only the personal window when the target site, not the input, fails", async () => {
  read.mockRejectedValueOnce(new HttpError(422, "페이지에 접속하지 못했습니다."));
  expect((await POST(request({ url: "https://example.com/", authorized: true }))).status).toBe(422);
  expect(refund).toHaveBeenCalledWith(["security:owner:guest"]);
  refund.mockClear();
  read.mockRejectedValueOnce(new HttpError(400, "공개 인터넷 주소만 분석할 수 있습니다."));
  expect((await POST(request({ url: "https://example.com/", authorized: true }))).status).toBe(400);
  expect(refund).not.toHaveBeenCalled();
});
