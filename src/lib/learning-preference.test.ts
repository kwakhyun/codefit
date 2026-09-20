import { expect, it } from "vitest";
import { defaultPreference, parsePreference, preferredDestinations } from "./learning-preference";
it("rejects stale and invalid browser settings", () => {
  for (const input of [null, "oops", "{}", '{"experience":"expert","purpose":"project"}'])
    expect(parsePreference(input)).toEqual(defaultPreference);
});
it("prioritizes intent independently from development experience while retaining all menus", () => {
  expect(preferredDestinations(defaultPreference)[0].href).toBe("/learn");
  expect(preferredDestinations({ experience: "developer", purpose: "learn" })[0].href).toBe(
    "/handoff",
  );
  for (const experience of ["developer", "beginner"] as const) {
    const result = preferredDestinations({ experience, purpose: "project" });
    expect(result[0].href).toBe("/project-check");
    expect(result[1].href).toBe("/security-check");
    expect(new Set(result.map((r) => r.href)).size).toBe(4);
  }
});
