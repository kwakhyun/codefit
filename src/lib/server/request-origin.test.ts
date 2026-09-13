import { describe, expect, it } from "vitest";
import { isAllowedOrigin } from "./request-origin";
describe("browser-origin protection", () => {
  it("accepts same-origin requests even when Next normalizes request.url", () => {
    const request = new Request("http://localhost:3010/api/generate", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3010",
        origin: "http://127.0.0.1:3010",
        "sec-fetch-site": "same-origin",
      },
    });
    expect(isAllowedOrigin(request)).toBe(true);
  });
  it("rejects cross-site requests, including a null origin", () => {
    for (const origin of ["https://attacker.example", "null", "http://localhost:3011"]) {
      expect(
        isAllowedOrigin(
          new Request("http://localhost:3010/api/progress/x", {
            method: "PUT",
            headers: { origin, host: "localhost:3010" },
          }),
        ),
      ).toBe(false);
    }
    expect(
      isAllowedOrigin(
        new Request("http://localhost:3010/api/export", {
          method: "POST",
          headers: { "sec-fetch-site": "cross-site" },
        }),
      ),
    ).toBe(false);
  });
  it("uses explicitly configured public origins behind a reverse proxy", () => {
    const request = new Request("http://localhost:3000/api/generate", {
      method: "POST",
      headers: { host: "localhost:3000", origin: "https://lab.example.com" },
    });
    expect(isAllowedOrigin(request, "https://lab.example.com")).toBe(true);
    expect(isAllowedOrigin(request, "https://other.example.com")).toBe(false);
  });
});
