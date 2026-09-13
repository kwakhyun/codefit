import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, loadavg } from "node:os";
import { gzipSync } from "node:zlib";

// Diagnostic follow-up: alternate the two production builds, preserving every sample.
const browser = await chromium.launch();
const samples = [];
mkdirSync("reports/traces", { recursive: true });
const code =
  Array.from({ length: 500 }, (_, i) => `def transform_${i}(value): return value * ${i}\n`).join(
    "",
  ) + "\n";
try {
  for (let pair = 0; pair < 5; pair++) {
    for (const label of pair % 2 ? ["after", "before"] : ["before", "after"]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 100,
        downloadThroughput: 1_250_000,
        uploadThroughput: 625_000,
      });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.addInitScript(() => {
        window.observed = { keys: [], longTasks: [], storage: [], commits: 0, measuring: false };
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
          supportsFiber: true,
          inject: () => 1,
          onCommitFiberRoot: () => window.observed.commits++,
          onCommitFiberUnmount: () => {},
        };
        document.addEventListener(
          "keydown",
          () => {
            if (!window.observed.measuring) return;
            const start = performance.now();
            requestAnimationFrame(() => window.observed.keys.push(performance.now() - start));
          },
          true,
        );
        new PerformanceObserver((list) => {
          if (window.observed.measuring)
            window.observed.longTasks.push(...list.getEntries().map((e) => e.duration));
        }).observe({ type: "longtask" });
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          const start = performance.now();
          const result = setItem.call(this, key, value);
          if (window.observed.measuring)
            window.observed.storage.push({
              area: this === localStorage ? "local" : "session",
              ms: performance.now() - start,
            });
          return result;
        };
      });
      const requests = [];
      page.on("request", (request) => {
        if (request.method() === "PUT") requests.push(new URL(request.url()).pathname);
      });
      await page.goto(
        `http://127.0.0.1:${label === "before" ? 3011 : 3010}/problems/be-pagination`,
      );
      await page.waitForFunction(() => window.monaco?.editor.getModels().length);
      await page.locator(".monaco-editor textarea").first().focus();
      await page.evaluate((value) => window.monaco.editor.getModels()[0].setValue(value), code);
      await page.waitForTimeout(1900);
      const startRequests = requests.length;
      await page.evaluate(() => {
        window.observed.keys = [];
        window.observed.longTasks = [];
        window.observed.commits = 0;
        window.observed.measuring = true;
      });
      const trace = [];
      cdp.on("Tracing.dataCollected", (e) => trace.push(...e.value));
      await cdp.send("Tracing.start", {
        categories: "devtools.timeline,blink.user_timing,v8.execute",
        transferMode: "ReportEvents",
      });
      const load = loadavg();
      await page
        .locator(".monaco-editor textarea")
        .first()
        .pressSequentially("# typed while autosave is active", { delay: 40 });
      await page.waitForTimeout(1900);
      const observed = await page.evaluate(() => window.observed);
      const ended = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
      await cdp.send("Tracing.end");
      await ended;
      const traceFile = `reports/traces/typing-pair-${pair}-${label}.json.gz`;
      writeFileSync(traceFile, gzipSync(JSON.stringify({ traceEvents: trace })));
      samples.push({
        pair,
        label,
        loadAverage: load,
        ...observed,
        requests: requests.slice(startRequests),
        traceFile,
      });
      console.log(
        JSON.stringify({
          pair,
          label,
          maximumKeyMs: Math.max(...observed.keys),
          commits: observed.commits,
        }),
      );
      await context.close();
    }
  }
  writeFileSync(
    "reports/typing-paired.json",
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        cpu: cpus()[0].model,
        browser: browser.version(),
        condition:
          "390x844 / CPU 4x / latency 100ms / 10Mbps down / 5Mbps up / production / identical 12 problems and fresh guest per sample",
        repetitions:
          "5 alternating pairs; traces on every sample; instrumented local/session storage durations",
        purpose:
          "Investigate variable constrained-mobile typing latency observed in the initial before/after run; this is a separate diagnostic, not a replacement of the original metrics",
        codeCharacters: code.length,
        samples,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
