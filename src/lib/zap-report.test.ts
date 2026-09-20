import { expect, it } from "vitest";
import { parseZapReport, zapReviewText } from "./zap-report";
const report = {
  site: [
    {
      "@name": "https://example.com",
      alerts: [
        {
          pluginid: "40012",
          alert: "Cross Site Scripting",
          riskcode: "3",
          confidence: "2",
          desc: "<p>Untrusted input</p>",
          solution: "<p>Encode output</p>",
          instances: [
            {
              uri: "https://example.com/item?token=secret#private",
              method: "GET",
              attack: "SECRET ATTACK",
              evidence: "SECRET BODY",
            },
            { uri: "https://other.example.com/item", method: "GET" },
          ],
        },
      ],
    },
  ],
};
it("filters exact origins, deduplicates rules and strips queries and raw attack evidence", () => {
  const input = structuredClone(report);
  input.site[0].alerts.push({ ...input.site[0].alerts[0], riskcode: "1" });
  const findings = parseZapReport(JSON.stringify(input), "https://example.com/path");
  expect(findings).toHaveLength(1);
  expect(findings[0].risk).toBe(3);
  expect(findings[0].locations).toEqual(["GET https://example.com/item"]);
  const text = zapReviewText("https://example.com/", findings);
  expect(text).not.toContain("secret");
  expect(text).not.toContain("SECRET");
  expect(text).not.toContain("<p>");
  expect(text).toContain("재검사");
});
it("rejects mismatched target, oversized, malformed and unrecognized severity", () => {
  expect(() => parseZapReport(JSON.stringify(report), "https://other.example.com/")).toThrow();
  expect(() => parseZapReport("x".repeat(4000001), "https://example.com")).toThrow();
  expect(() => parseZapReport("{}", "https://example.com")).toThrow();
  const bad = structuredClone(report);
  bad.site[0].alerts[0].riskcode = "urgent";
  expect(() => parseZapReport(JSON.stringify(bad), "https://example.com")).toThrow();
});
