import { expect, it } from "vitest";
import { defaultPreference, parsePreference, preferredDestinations } from "./learning-preference";
import { learnerTypes, learnerType, preferenceForType } from "./learner-types";
it("rejects invalid browser settings", () => {
  for (const input of [
    null,
    "oops",
    "{}",
    '{"experience":"expert","purpose":"project"}',
    '{"version":2,"type":"admin"}',
  ])
    expect(parsePreference(input)).toEqual(defaultPreference);
});
it("migrates all four existing choices without changing their intention", () => {
  for (const item of learnerTypes) {
    const legacy = { experience: item.experience, purpose: item.purpose };
    expect(learnerType(parsePreference(JSON.stringify(legacy))).id).toBe(item.id);
    expect(parsePreference(JSON.stringify({ version: 2, type: item.id }))).toEqual(legacy);
    expect(preferenceForType(item.id)).toEqual(legacy);
  }
});
it("prioritizes project checks for every type while retaining every destination", () => {
  learnerTypes.forEach((item) => {
    const result = preferredDestinations(preferenceForType(item.id));
    expect(result[0].href).toBe("/project-check");
    const paths = result.map((destination) => destination.href);
    expect(paths.indexOf("/learn/ai")).toBeLessThan(paths.indexOf("/learn"));
    expect(new Set(result.map((item) => item.href)).size).toBe(5);
  });
});
