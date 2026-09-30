import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  requestWorkshopAnalysis,
  requestWorkshopGeneration,
  takeWorkshopAnalysis,
  takeWorkshopGeneration,
} from "./workshop-autostart";

describe("workshop hand-offs", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("starts confirmed work once and only for the confirmed target", () => {
    expect(takeWorkshopAnalysis("https://github.com/a/b")).toBe(false);
    requestWorkshopAnalysis("https://github.com/a/b");
    expect(takeWorkshopAnalysis("https://github.com/a/c")).toBe(false);
    expect(takeWorkshopAnalysis("https://github.com/a/b")).toBe(false);
    requestWorkshopAnalysis("https://github.com/a/b");
    expect(takeWorkshopAnalysis("https://github.com/a/b")).toBe(true);
    expect(takeWorkshopAnalysis("https://github.com/a/b")).toBe(false);
    requestWorkshopGeneration("check-1");
    expect(takeWorkshopGeneration("check-1")).toBe(true);
    expect(takeWorkshopGeneration("check-1")).toBe(false);
  });
  it("never starts work when storage is unavailable", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    requestWorkshopAnalysis("https://github.com/a/b");
    expect(takeWorkshopAnalysis("https://github.com/a/b")).toBe(false);
  });
});
