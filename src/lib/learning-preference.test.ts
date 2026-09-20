import { expect, it } from "vitest";
import { defaultPreference, parsePreference, preferredDestinations } from "./learning-preference";
import { learnerTypes, learnerType, preferenceForType } from "./learner-types";
it("rejects invalid browser settings", () => {
  for (const raw of [null, "oops", "{}", '{"version":3,"type":"admin"}'])
    expect(parsePreference(raw)).toEqual(defaultPreference);
});
it("migrates the four old choices into three workspaces", () => {
  const old = { starter: "ai", coder: "code", maker: "service", builder: "service" };
  for (const [before, after] of Object.entries(old))
    expect(learnerType(parsePreference(JSON.stringify({ version: 2, type: before }))).id).toBe(
      after,
    );
  expect(learnerType(parsePreference('{"experience":"beginner","purpose":"learn"}')).id).toBe("ai");
  expect(learnerType(parsePreference('{"experience":"developer","purpose":"project"}')).id).toBe(
    "service",
  );
});
it("restores every new workspace without changing its purpose", () => {
  for (const item of learnerTypes)
    expect(parsePreference(JSON.stringify({ version: 3, type: item.id }))).toEqual(
      preferenceForType(item.id),
    );
});
it("gives each workspace its own first destination, with basic lessons last", () => {
  const first = { service: "/project-check", ai: "/learn/ai", code: "/?view=browse" };
  for (const item of learnerTypes) {
    const result = preferredDestinations(preferenceForType(item.id));
    expect(result[0].href).toBe(first[item.id]);
    expect(result.at(-1)?.href).toBe("/learn");
    expect(new Set(result.map((d) => d.href)).size).toBe(6);
  }
});
