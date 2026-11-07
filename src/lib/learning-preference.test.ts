import { expect, it } from "vitest";
import {
  defaultPreference,
  navigationGroups,
  parsePreference,
  preferenceSeed,
  preferredDestinations,
} from "./learning-preference";
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
it("gives each workspace its own first destination and keeps every destination", () => {
  const first = { service: "/project-check", ai: "/learn/ai", code: "/?view=browse" };
  for (const item of learnerTypes) {
    const result = preferredDestinations(preferenceForType(item.id));
    expect(result[0].href).toBe(first[item.id]);
    expect(new Set(result.map((d) => d.href)).size).toBe(7);
  }
});
it("groups destinations by meaning and leads with the chosen workspace", () => {
  const lead = { service: "내 서비스 점검", ai: "AI 활용", code: "코드와 원리" };
  const members: Record<string, string[]> = {
    "내 서비스 점검": ["/project-check", "/security-check"],
    "AI 활용": ["/learn/ai", "/learn/ai/project"],
    "코드와 원리": ["/handoff", "/?view=browse", "/learn"],
  };
  for (const item of learnerTypes) {
    const groups = navigationGroups(preferenceForType(item.id));
    expect(groups[0].caption).toBe(lead[item.id]);
    for (const group of groups)
      expect(group.items.map((d) => d.href).sort()).toEqual([...members[group.caption]].sort());
  }
});
it("seeds the server render only from a known workspace cookie", () => {
  expect(parsePreference(preferenceSeed("ai"))).toEqual(preferenceForType("ai"));
  for (const value of [undefined, "", "admin", '{"type":"ai"}'])
    expect(preferenceSeed(value)).toBe(null);
});
