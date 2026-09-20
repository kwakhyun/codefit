import { describe, expect, it } from "vitest";
import { MISSIONS } from "../catalog";
import { SERVICE_CASES } from "./cases";
import { SERVICE_DOMAINS, domainFor } from "./domains";
import { applyAction, initialSimulation, simulate, verification, reproduced } from "../simulation";
import { evaluateService } from "./rules";

describe("domain curriculum contract", () => {
  it("curates active cases in every domain while preserving legacy definitions", () => {
    expect(SERVICE_CASES).toHaveLength(20);
    expect(MISSIONS).toHaveLength(21);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
    for (const domain of SERVICE_DOMAINS) {
      expect(SERVICE_CASES.filter((c) => c.domain === domain.id)).toHaveLength(4);
      expect(MISSIONS.filter((m) => domainFor(m) === domain.id).length).toBeGreaterThanOrEqual(2);
    }
    for (const m of MISSIONS.filter((m) => m.service)) {
      expect(new Set(m.choices).size, m.id).toBe(3);
      const c = m.service!;
      expect(evaluateService(c, 1, "")).not.toMatchObject(c.samples[1].expected);
      for (let i = 0; i < 3; i++) {
        const result = evaluateService(c, i, "rule");
        expect(
          {
            allowed: result.allowed,
            ...(result.amount === undefined ? {} : { amount: result.amount }),
          },
          `${c.id}/${i}`,
        ).toEqual(c.samples[i].expected);
      }
    }
  });
  it("replays selected input and processing history without mutating earlier states or confirming unprocessed input", () => {
    for (const m of MISSIONS.filter((m) => m.service)) {
      expect(reproduced(m, ["case-edge", "case-standard", "case-submit"])).toBe(false);
      expect(reproduced(m, ["case-edge", "case-submit"])).toBe(true);
      const initial = initialSimulation();
      const selected = applyAction(m, initial, "case-edge");
      const processed = applyAction(m, selected, "case-submit");
      expect(initial.service.selected).toBe(0);
      expect(selected.service.history).toEqual([]);
      expect(processed.service.history).toHaveLength(1);
      const changed = applyAction(m, processed, "case-standard");
      expect(changed.service.result).toBeNull();
      expect(changed.service.history).toHaveLength(1);
      expect(processed.service.selected).toBe(1);
      expect(simulate(m, m.reproduce).service).toEqual(processed.service);
      expect(verification(m, "rule").every((c) => c.passed)).toBe(true);
    }
  });
});
