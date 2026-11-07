import { beforeEach, expect, it, vi } from "vitest";
beforeEach(() => vi.resetModules());
it("maps every task to one of four actionable states or a finished one", async () => {
  const { analysisState } = await import("./project-analysis-tasks");
  expect(analysisState({ status: "pending" })).toBe("running");
  expect(analysisState({ status: "disconnected" })).toBe("disconnected");
  expect(analysisState({ status: "failed", code: 422 })).toBe("input");
  expect(analysisState({ status: "failed", code: 400 })).toBe("input");
  expect(analysisState({ status: "failed", code: 429 })).toBe("failed");
  expect(analysisState({ status: "failed" })).toBe("failed");
  expect(analysisState({ status: "done" })).toBe("done");
  expect(analysisState({ status: "cancelled" })).toBe("cancelled");
});
it("lets the current page claim the jobs it shows and releases them on cleanup", async () => {
  const m = await import("./project-analysis-tasks");
  const listener = vi.fn();
  m.subscribeAnalysis(listener);
  const release = m.showAnalysisOnPage(["a", "b"]);
  expect(m.isAnalysisShownOnPage("a")).toBe(true);
  expect(listener).toHaveBeenCalledTimes(1);
  m.showAnalysisOnPage(["a", "b"]);
  expect(listener).toHaveBeenCalledTimes(1);
  release();
  expect(m.isAnalysisShownOnPage("a")).toBe(false);
});
