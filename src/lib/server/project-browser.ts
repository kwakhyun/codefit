import { Sandbox, type NetworkPolicy } from "@vercel/sandbox";
import { z } from "zod";
import { captureSchema, type PageSnapshot } from "../project-check/types";
import { publicUrl, readPublicPage } from "./project-page";
import { projectBrowserScript } from "./project-browser-script";

// The VM firewall applies to redirects and subresources too, including DNS rebinding.
export const browserNetworkPolicy = {
  allow: ["*"],
  subnets: {
    deny: [
      "0.0.0.0/8",
      "10.0.0.0/8",
      "100.64.0.0/10",
      "127.0.0.0/8",
      "169.254.0.0/16",
      "172.16.0.0/12",
      "192.0.0.0/24",
      "192.0.2.0/24",
      "192.168.0.0/16",
      "198.18.0.0/15",
      "198.51.100.0/24",
      "203.0.113.0/24",
      "224.0.0.0/4",
      "240.0.0.0/4",
    ],
  },
} satisfies NetworkPolicy;
const outputSchema = z
  .object({
    pages: z.array(captureSchema).max(3),
    failures: z.array(z.string().max(1500)).max(100),
  })
  .strict();

export async function renderPublicProject(url: string, signal: AbortSignal): Promise<PageSnapshot> {
  publicUrl(url);
  const snapshotId = process.env.PROJECT_BROWSER_SNAPSHOT_ID;
  if (!snapshotId) throw new Error("Browser snapshot is not configured");
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(40_000)]);
  const sandbox = await Sandbox.create({
    source: { type: "snapshot", snapshotId },
    persistent: false,
    timeout: 45_000,
    networkPolicy: browserNetworkPolicy,
    signal: bounded,
  });
  try {
    // Sandbox firewall CIDRs are IPv4-only; disable IPv6 before executing untrusted pages.
    const ipv6 = await sandbox.runCommand({
      cmd: "sysctl",
      args: ["-w", "net.ipv6.conf.all.disable_ipv6=1", "net.ipv6.conf.default.disable_ipv6=1"],
      sudo: true,
      signal: bounded,
    });
    if (ipv6.exitCode !== 0) throw new Error("Could not restrict browser networking");
    await sandbox.writeFiles(
      [
        { path: "/vercel/sandbox/input.json", content: Buffer.from(JSON.stringify({ url })) },
        {
          path: "/vercel/sandbox/capture.mjs",
          content: Buffer.from(
            "import {createRequire} from 'node:module';const require=createRequire(import.meta.url);\n" +
              projectBrowserScript,
          ),
        },
      ],
      { signal: bounded },
    );
    const command = await sandbox.runCommand({
      cmd: "node",
      args: ["/vercel/sandbox/capture.mjs"],
      signal: bounded,
    });
    if (command.exitCode !== 0) throw new Error("Browser capture failed");
    const raw = await sandbox.readFileToBuffer(
      { path: "/vercel/sandbox/result.json" },
      { signal: bounded },
    );
    if (!raw || raw.length > 900_000) throw new Error("Invalid capture size");
    const result = outputSchema.parse(JSON.parse(raw.toString()));
    if (!result.pages.length || !result.pages.some((p) => p.text.length >= 100))
      throw new Error("No readable rendered page");
    for (const page of result.pages) publicUrl(page.url);
    return {
      url: result.pages[0].url,
      title: result.pages[0].title,
      text: result.pages.map((p, i) => `[화면 ${i + 1}: ${p.url}]\n${p.text}`).join("\n\n"),
      fetchedAt: new Date().toISOString(),
      limited: result.pages.reduce((sum, p) => sum + p.text.length, 0) < 200,
      source: "rendered",
      captures: result.pages,
      collectionNote: `공개 화면 ${result.pages.length}곳을 읽었습니다. 최대 3곳을 약 30초 이내로 수집합니다. 스크롤하고 공개 접기 항목을 펼쳐 읽었습니다. 로그인, 입력, 버튼 실행, 서버 내부는 검사하지 않았습니다.${result.failures.length ? ` ${result.failures.length}곳은 읽지 못했습니다.` : ""}`,
    };
  } finally {
    await sandbox.stop({ signal: AbortSignal.timeout(3000) }).catch(() => {});
  }
}

export async function readProjectPages(url: string, signal: AbortSignal): Promise<PageSnapshot> {
  try {
    return await renderPublicProject(url, signal);
  } catch {
    signal.throwIfAborted();
    const page = await readPublicPage(url, signal);
    return {
      ...page,
      collectionNote:
        "자바스크립트 화면 수집을 완료하지 못해 HTML과 사이트 소개 정보를 사용했습니다. 화면에 실제로 표시된 내용이나 오류인지는 확인하지 못했습니다.",
    };
  }
}
