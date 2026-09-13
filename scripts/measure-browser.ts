import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { percentile } from "../src/lib/evaluation";

const base = "http://127.0.0.1:3010";
const browser = await chromium.launch();
const measurements = [];
try {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    const samples = [];
    for (let i = 0; i < 3; i++) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await page.addInitScript(() => {
        const metrics = { lcp: 0, cls: 0 };
        Object.assign(window, { codefitMetrics: metrics });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) metrics.lcp = entry.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            hadRecentInput: boolean;
            value: number;
          })[])
            if (!entry.hadRecentInput) metrics.cls += entry.value;
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(base);
      await page.locator(".problem-row").first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1000);
      const sample = await page.evaluate(() => {
        const m = (window as unknown as { codefitMetrics: { lcp: number; cls: number } })
          .codefitMetrics;
        const navigation = performance.getEntriesByType(
          "navigation",
        )[0] as PerformanceNavigationTiming;
        return {
          lcpMs: Math.round(m.lcp),
          observedLayoutShift: m.cls,
          domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
          pageBytes: document.documentElement.outerHTML.length,
        };
      });
      samples.push(sample);
      await context.close();
    }
    measurements.push({
      viewport,
      samples,
      lcpP50Ms: percentile(
        samples.map((s) => s.lcpMs),
        0.5,
      ),
    });
  }
  const report = {
    measuredAt: new Date().toISOString(),
    browser: browser.version(),
    node: process.version,
    cpu: cpus()[0]?.model,
    environment:
      "Local production build, no CPU/network throttling, three fresh contexts per viewport, 1 second observation after rows and fonts are ready",
    limitations:
      "Lab samples only. Layout shift is the observed sum during this short load window, not the full CLS session-window metric. These results are not field Core Web Vitals, INP, Lighthouse scores or production latency.",
    measurements,
  };
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/browser-performance.json", JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify(measurements.map(({ viewport, lcpP50Ms }) => ({ viewport, lcpP50Ms }))),
  );
} finally {
  await browser.close();
}
