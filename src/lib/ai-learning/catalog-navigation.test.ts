import { describe, expect, it } from "vitest";
import { catalogFilters, catalogReturn, catalogUrl } from "./catalog-navigation";

describe("AI catalog return paths", () => {
  it("round trips a Korean search with category and level", () => {
    const filters = { query: "랭그래프", track: "frameworks", level: "기초" };
    const url = catalogUrl(filters);
    expect(catalogReturn(url)).toBe(url);
    expect(catalogFilters(new URLSearchParams(url.split("?")[1]))).toEqual(filters);
  });
  it("rejects external, executable and unrelated return paths", () => {
    for (const value of [
      "https://example.com",
      "//example.com",
      "javascript:alert(1)",
      "/learn/ai/../../admin",
      ["/learn/ai"],
      undefined,
    ]) {
      expect(catalogReturn(value)).toBe("/learn/ai");
    }
  });
  it("drops unsupported filters and arbitrary query parameters", () => {
    expect(catalogReturn("/learn/ai?track=bad&level=bad&next=https://example.com")).toBe(
      "/learn/ai",
    );
  });
});
