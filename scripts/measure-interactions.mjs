import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { cpus, platform, release } from "node:os";
import { execFileSync } from "node:child_process";

const label = process.argv[2];
if (!["before", "after"].includes(label)) throw new Error("Choose before or after.");
const base = "http://127.0.0.1:3010";
const browser = await chromium.launch();
const samples = [];
mkdirSync(`artifacts/performance-${label}`, { recursive: true });
try {
  for (const condition of [
    { name: "desktop-local", latency: 0, cpu: 1, width: 1440, height: 1000 },
    { name: "mobile-constrained", latency: 100, cpu: 4, width: 390, height: 844 },
  ]) {
    for (let repetition = 0; repetition < 5; repetition++) {
      const context = await browser.newContext({ viewport: condition });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: condition.latency,
        downloadThroughput: condition.latency ? 1_250_000 : -1,
        uploadThroughput: condition.latency ? 625_000 : -1,
      });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: condition.cpu });
      await page.addInitScript(() => {
        const observed = { commits: 0, keys: [], longTasks: [] };
        window.codefitObserved = observed;
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
          supportsFiber: true,
          inject: () => 1,
          onCommitFiberRoot: () => observed.commits++,
          onCommitFiberUnmount: () => {},
        };
        addEventListener(
          "keydown",
          () => {
            const start = performance.now();
            requestAnimationFrame(() => observed.keys.push(performance.now() - start));
          },
          true,
        );
        new PerformanceObserver((list) => {
          for (const e of list.getEntries())
            observed.longTasks.push({ start: e.startTime, duration: e.duration });
        }).observe({ type: "longtask", buffered: true });
      });
      const requests = [];
      page.on("request", (r) => {
        if (r.url().includes("/api/"))
          requests.push({ path: new URL(r.url()).pathname, method: r.method() });
      });
      const resources = () =>
        page.evaluate(() =>
          performance
            .getEntriesByType("resource")
            .filter((e) => e.name.includes("/api/"))
            .map((e) => ({
              path: new URL(e.name).pathname,
              start: e.startTime,
              end: e.responseEnd,
              duration: e.duration,
            })),
        );
      await page.goto(base);
      await page.locator(".problem-row").first().waitFor();
      const listMs = await page.evaluate(() => performance.now());
      const listRequests = await resources();
      const searchStart = requests.length;
      const commitsBeforeSearch = await page.evaluate(() => window.codefitObserved.commits);
      await page
        .getByRole("textbox", { name: "문제 검색" })
        .pressSequentially("TCP", { delay: 50 });
      await page.waitForFunction(
        () =>
          document.querySelectorAll(".problem-row").length === 1 &&
          document.querySelector(".problem-row")?.textContent.includes("TCP"),
      );
      await page.waitForTimeout(900);
      const search = {
        requests: requests.slice(searchStart),
        commits: (await page.evaluate(() => window.codefitObserved.commits)) - commitsBeforeSearch,
      };
      await page.goto(base + "/problems/be-pagination");
      await page.waitForFunction(
        () =>
          window.monaco?.editor.getModels().length &&
          document.querySelector(".monaco-editor textarea"),
      );
      await page.locator(".monaco-editor textarea").first().focus();
      const editorMs = await page.evaluate(() => performance.now());
      const editorRequests = await resources();
      const code =
        Array.from(
          { length: 500 },
          (_, i) => `def transform_${i}(value): return value * ${i}\n`,
        ).join("") + "\n";
      await page.evaluate((value) => window.monaco.editor.getModels()[0].setValue(value), code);
      await page.waitForTimeout(1500 + condition.latency * 4);
      const typingStart = requests.length;
      await page.evaluate(() => {
        window.codefitObserved.keys = [];
        window.codefitObserved.longTasks = [];
      });
      const commitsBeforeTyping = await page.evaluate(() => window.codefitObserved.commits);
      const events = [];
      if (repetition === 0) {
        cdp.on("Tracing.dataCollected", (e) => events.push(...e.value));
        await cdp.send("Tracing.start", {
          categories: "devtools.timeline,blink.user_timing,v8.execute",
          transferMode: "ReportEvents",
        });
      }
      await page
        .locator(".monaco-editor textarea")
        .first()
        .pressSequentially("# typed while autosave is active", { delay: 40 });
      await page.waitForTimeout(1500 + condition.latency * 4);
      const typing = await page.evaluate(() => window.codefitObserved);
      if (repetition === 0) {
        const ended = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
        await cdp.send("Tracing.end");
        await ended;
        writeFileSync(
          `artifacts/performance-${label}/${condition.name}-typing.trace.json`,
          JSON.stringify({ traceEvents: events }),
        );
      }
      samples.push({
        condition: condition.name,
        repetition,
        listMs,
        editorMs,
        listRequests,
        editorRequests,
        search,
        typing: {
          codeCharacters: code.length,
          keyToAnimationFrameMs: typing.keys,
          longTasks: typing.longTasks,
          commits: typing.commits - commitsBeforeTyping,
          requests: requests.slice(typingStart),
        },
      });
      console.log(
        JSON.stringify({
          condition: condition.name,
          repetition,
          listMs: Math.round(listMs),
          editorMs: Math.round(editorMs),
        }),
      );
      await context.close();
    }
  }
  writeFileSync(
    `reports/interactions-${label}.json`,
    JSON.stringify(
      {
        label,
        measuredAt: new Date().toISOString(),
        commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        sourceFingerprint: createHash("sha256")
          .update(
            readdirSync("src", { recursive: true })
              .filter((name) => /\.(ts|tsx|css|mjs|mts)$/.test(name) && !name.includes(".test"))
              .sort()
              .map((name) => name + "\0" + readFileSync(`src/${name}`, "utf8"))
              .join("\0"),
          )
          .digest("hex"),
        workingTreeChanges: Boolean(
          execFileSync("git", ["diff", "--name-only", "--", "src"], { encoding: "utf8" }).trim(),
        ),
        environment: {
          node: process.version,
          browser: browser.version(),
          cpu: cpus()[0]?.model,
          platform: platform(),
          os: release(),
          database:
            "SQLite / current curated seed bank / use equal counts for compared builds / fresh isolated database per build / fresh guest per sample",
          build: "next build / production / React StrictMode / no dev server",
          cache: "new browser context, HTTP cache disabled, warmed local server",
          repetitions: 5,
          desktop: "1440x1000, no CPU or network throttling",
          mobile: "390x844, 4x CPU slowdown, 100ms CDP latency, 10Mbps down / 5Mbps up",
        },
        limitations:
          "Local lab only. Locator-ready times include automation observation overhead. Key-to-next-animation-frame is not INP. React DevTools hook counts root commits, not individual component renders. CDP tracing runs on the first typing sample of each condition in BOTH builds; compare like-for-like. No AI calls or production DB used.",
        samples,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
