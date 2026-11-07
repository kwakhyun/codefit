import { afterEach, expect, it, vi } from "vitest";
import { applyStoredTheme, themeInitScript } from "./theme-init";

afterEach(() => vi.unstubAllGlobals());

function stub(stored: string | null, dark: boolean, blocked = false) {
  const dataset: Record<string, string> = {};
  vi.stubGlobal("document", { documentElement: { dataset } });
  vi.stubGlobal("localStorage", {
    getItem: () => {
      if (blocked) throw new Error("blocked");
      return stored;
    },
  });
  vi.stubGlobal("matchMedia", () => ({ matches: dark }));
  return dataset;
}

it("applies the stored theme the same way as the inline head script", () => {
  for (const [stored, dark, blocked] of [
    ["light", true, false],
    ["dark", false, false],
    [null, true, false],
    ["unknown", false, false],
    ["dark", false, true],
  ] as const) {
    const fromScript = stub(stored, dark, blocked);
    new Function(themeInitScript)();
    const fromFunction = stub(stored, dark, blocked);
    applyStoredTheme();
    expect(fromFunction).toEqual(fromScript);
  }
});
