import path from "node:path";
import { z } from "zod";
import type { PageSnapshot } from "../project-check/types";
import {
  sourceLine,
  type RepositoryFile,
  type RepositorySnapshot,
} from "../project-check/repository";
import { HttpError } from "./http";
import { publicUrl } from "./project-page";

export function githubTarget(raw: string) {
  const url = publicUrl(raw);
  if (url.hostname !== "github.com") return null;
  const match = /^\/([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\/pull\/([1-9]\d*))?\/?$/.exec(
    url.pathname,
  );
  if (!match || [".", ".."].includes(match[2]))
    throw new HttpError(
      400,
      "GitHub 공개 저장소 주소 또는 /pull/번호 형식의 PR 주소를 입력해 주세요.",
    );
  return { name: `${match[1]}/${match[2]}`, pullRequest: match[3] ? Number(match[3]) : undefined };
}
const sha = z.string().regex(/^[a-f0-9]{40}$/);
const treeItem = z.object({
  path: z.string().max(500),
  type: z.string(),
  mode: z.string(),
  sha,
  size: z.number().optional(),
});
const treeSchema = z.object({ tree: z.array(treeItem).max(50000), truncated: z.boolean() });
const safePath = (value: string) =>
  !value.split("/").some((p) => !p || p === "." || p === "..") && !/[\x00-\x1f\\]/.test(value);
export const repositorySourcePolicy = {
  excludedSegments:
    /(^|\/)(node_modules|vendor|dist|build|coverage|\.git|\.next|fixtures|__pycache__)(\/|$)/
      .source,
  excludedNames: /(^|\/)(\.env[^/]*|[^/]*(?:secret|credential|private.key)[^/]*|[^/]+\.min\.[jt]s)$/
    .source,
  extensions:
    /\.(py|tsx?|jsx?|mjs|go|java|rs|md|toml|ya?ml|cs|c|cpp|h|swift|kt|rb|php|vue|svelte|sql)$/
      .source,
  priorities: [
    { pattern: /^readme\.md$/.source, rank: 0 },
    {
      pattern: /(^|\/)(tests?|docs|examples|scripts|changes|infra|\.github)\/|(?:test|spec)\.[^.]+$/
        .source,
      rank: 8,
    },
    {
      pattern:
        /(auth|permission|policy|gate|signing|approval|storage|payment|route|main|cli|service)/
          .source,
      rank: 1,
    },
    {
      pattern: /\.(py|[jt]sx?|mjs|go|java|rs|cs|c|cpp|h|swift|kt|rb|php|vue|svelte|sql)$/.source,
      rank: 3,
    },
  ],
};
export function eligibleSource(value: string) {
  return (
    safePath(value) &&
    !new RegExp(repositorySourcePolicy.excludedSegments, "i").test(value) &&
    !new RegExp(repositorySourcePolicy.excludedNames, "i").test(value) &&
    new RegExp(repositorySourcePolicy.extensions, "i").test(value)
  );
}
function sourcePriority(value: string) {
  return (
    repositorySourcePolicy.priorities.find((p) => new RegExp(p.pattern, "i").test(value))?.rank ?? 6
  );
}
// These are review locations, not vulnerability findings. No target code is executed.
const decisionLine =
  /\b(if |raise |except |catch\b|throw |return |verify|authorize|permission|transaction|commit\(|write|sign\(|exec\(|eval\(|pickle\.|subprocess\.)/;
export function extractSource(
  filePath: string,
  text: string,
  changedLines?: Set<number>,
): RepositoryFile {
  const all = text.replace(/\r\n/g, "\n").split("\n");
  const selected = new Set<number>();
  const add = (i: number, radius: number) => {
    for (let n = Math.max(0, i - radius); n <= Math.min(all.length - 1, i + radius); n++)
      selected.add(n);
  };
  if (changedLines) for (const line of [...changedLines].slice(0, 100)) add(line - 1, 3);
  else if (text.length <= 6500) all.forEach((_, i) => selected.add(i));
  else {
    for (let i = 0; i < Math.min(all.length, 25); i++) selected.add(i);
    // Spread evidence throughout large files instead of reading only their header.
    const candidates = all.flatMap((line, i) => (decisionLine.test(line) ? [i] : []));
    for (let n = 0; n < Math.min(candidates.length, 14); n++)
      add(candidates[Math.floor((n * candidates.length) / Math.min(candidates.length, 14))], 3);
  }
  let length = 0;
  let inKey = false;
  const sanitized = all.map((line) => {
    if (/-----BEGIN .*PRIVATE KEY-----/.test(line)) inKey = true;
    const hide =
      inKey ||
      /(?:api[_-]?key|secret|password|token)\s*[=:]\s*["'][^"']{8,}["']/i.test(line) ||
      /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b/.test(line);
    if (/-----END .*PRIVATE KEY-----/.test(line)) inKey = false;
    return hide ? "[민감한 값으로 보이는 줄 제외]" : line;
  });
  const lines = [...selected]
    .sort((a, b) => a - b)
    .flatMap((i) => {
      const text = sanitized[i].slice(0, 400);
      if (length + text.length > 6500) return [];
      length += text.length;
      return [{ number: i + 1, text }];
    });
  return {
    path: filePath,
    totalLines: all.length,
    lines,
    partial: lines.length < all.length || all.some((l) => l.length > 400),
    ...(changedLines ? { changed: true } : {}),
  };
}
export function addedLines(patch: string) {
  const lines = new Set<number>();
  let line = 0;
  for (const text of patch.split("\n")) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (!line || text.startsWith("-") || text.startsWith("\\")) continue;
    if (text.startsWith("+")) lines.add(line);
    if (text.startsWith("+") || text.startsWith(" ")) line++;
  }
  return lines;
}
export function importLinks(files: RepositoryFile[]): RepositorySnapshot["links"] {
  const links: RepositorySnapshot["links"] = [];
  const modules = new Map(
    files.map((f) => [
      f.path.replace(/\.(py|[jt]sx?|mjs)$/, "").replace(/\/(?:__init__|index)$/, ""),
      f.path,
    ]),
  );
  for (const f of files)
    for (const line of f.lines) {
      const python = /^\s*(?:from\s+([.\w]+)\s+import|import\s+([\w.]+))/.exec(line.text);
      const js = /(?:\bfrom\s*|\brequire\s*\()\s*["']([^"']+)["']/.exec(line.text);
      let name = python?.[1] || python?.[2];
      if (name) {
        const dots = /^\.+/.exec(name)?.[0].length || 0;
        name = dots
          ? path.posix.join(
              path.posix.dirname(f.path),
              ...Array(Math.max(0, dots - 1)).fill(".."),
              name.slice(dots).replaceAll(".", "/"),
            )
          : name.replaceAll(".", "/");
      } else if (js?.[1].startsWith("."))
        name = path.posix
          .normalize(path.posix.join(path.posix.dirname(f.path), js[1]))
          .replace(/\.(js|ts)$/, "");
      const to = name && modules.get(name);
      if (to && to !== f.path && !links.some((l) => l.from === f.path && l.to === to))
        links.push({ from: f.path, to });
    }
  return links;
}

/** Fixed GitHub API and raw-file origins, no credentials, redirects, checkout, subprocess or project execution. */
export async function readProjectRepository(
  raw: string,
  outer: AbortSignal,
  request: typeof fetch = fetch,
): Promise<PageSnapshot> {
  const target = githubTarget(raw);
  if (!target) throw new HttpError(400, "GitHub 저장소 주소가 필요합니다.");
  const signal = AbortSignal.any([outer, AbortSignal.timeout(40_000)]);
  async function get<T>(suffix: string, schema: z.ZodType<T>): Promise<T> {
    const response = await request(
      `https://api.github.com/repos/${target!.name}${suffix ? `/${suffix}` : ""}`,
      {
        signal,
        redirect: "error",
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "CODEFIT-public-project-review",
        },
        cache: "no-store",
      },
    );
    if (!response.ok) {
      if (
        response.status === 429 ||
        (response.status === 403 &&
          (response.headers.get("x-ratelimit-remaining") === "0" ||
            response.headers.has("retry-after")))
      ) {
        const retry = githubRetryDelay(response.headers);
        const wait = retry
          ? `약 ${Math.ceil(retry / 60)}분 뒤 다시 시도해 주세요.`
          : "GitHub가 재시도 시간을 제공하지 않았습니다. 잠시 후 다시 시도해 주세요.";
        throw new HttpError(
          429,
          `GitHub의 공개 코드 조회 요청이 많아 잠시 기다려야 합니다. ${wait} AI 분석 횟수는 차감되지 않았습니다.`,
          retry,
        );
      }
      throw new HttpError(422, "공개 저장소를 읽지 못했습니다. 주소와 공개 여부를 확인해 주세요.");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new HttpError(422, "GitHub 응답을 읽지 못했습니다.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4_000_000)
          throw new HttpError(
            422,
            "저장소 목록이 너무 큽니다. 범위를 좁힌 PR 주소를 사용해 주세요.",
          );
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const parsed = schema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!parsed.success) throw new HttpError(422, "GitHub 소스 정보 형식을 확인하지 못했습니다.");
    return parsed.data;
  }
  const meta = await get(
    "",
    z.object({ private: z.boolean(), default_branch: z.string().max(200) }),
  );
  if (meta.private) throw new HttpError(422, "공개 저장소만 분석할 수 있습니다.");
  let commit: string;
  let changed: Map<string, Set<number>> | undefined;
  let changedCount = 0;
  if (target.pullRequest) {
    const pr = await get(
      `pulls/${target.pullRequest}`,
      z.object({ head: z.object({ sha }), changed_files: z.number() }),
    );
    commit = pr.head.sha;
    changedCount = pr.changed_files;
    const prFiles = await get(
      `pulls/${target.pullRequest}/files?per_page=100`,
      z
        .array(z.object({ filename: z.string(), status: z.string(), patch: z.string().optional() }))
        .max(100),
    );
    changed = new Map(
      prFiles
        .filter((f) => f.status !== "removed" && f.patch)
        .map((f) => [f.filename, addedLines(f.patch!)]),
    );
    // The files endpoint follows the current PR head; reject a concurrent force-push.
    const latest = await get(`pulls/${target.pullRequest}`, z.object({ head: z.object({ sha }) }));
    if (latest.head.sha !== commit)
      throw new HttpError(409, "PR이 수집 중 변경됐습니다. 다시 분석해 주세요.");
  } else {
    commit = (await get(`commits/${encodeURIComponent(meta.default_branch)}`, z.object({ sha })))
      .sha;
  }
  const tree = await get(`git/trees/${commit}?recursive=1`, treeSchema);
  const blobs = tree.tree.filter((f) => f.type === "blob" && ["100644", "100755"].includes(f.mode));
  const eligible = blobs.filter(
    (f) =>
      eligibleSource(f.path) &&
      (f.size || 0) <= 100_000 &&
      (!changed || (changed.get(f.path)?.size || 0) > 0),
  );
  const selected = eligible
    .sort((a, b) => sourcePriority(a.path) - sourcePriority(b.path) || a.path.localeCompare(b.path))
    .slice(0, 16);
  const files: RepositoryFile[] = [];
  for (let i = 0; i < selected.length; i += 4) {
    const batch = await Promise.all(
      selected.slice(i, i + 4).map(async (f) => {
        let text: string;
        if (target.pullRequest) {
          const blob = await get(
            `git/blobs/${f.sha}`,
            z.object({
              encoding: z.literal("base64"),
              content: z.string().max(150000),
              size: z.number().max(100000),
            }),
          );
          text = Buffer.from(blob.content, "base64").toString("utf8");
        } else {
          // Public raw files do not consume a REST request for every source file.
          const response = await request(
            `https://raw.githubusercontent.com/${target.name}/${commit}/${f.path.split("/").map(encodeURIComponent).join("/")}`,
            { signal, redirect: "error", cache: "no-store" },
          );
          if (!response.ok)
            throw new HttpError(
              422,
              "선택한 공개 코드 파일을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.",
            );
          const reader = response.body?.getReader();
          if (!reader) throw new HttpError(422, "코드 파일을 읽지 못했습니다.");
          const parts: Uint8Array[] = [];
          let size = 0;
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              size += value.byteLength;
              if (size > 100000)
                throw new HttpError(422, "코드 파일이 수집 크기 제한을 넘었습니다.");
              parts.push(value);
            }
          } finally {
            await reader.cancel();
          }
          text = Buffer.concat(parts).toString("utf8");
        }
        return text.includes("\0") ? null : extractSource(f.path, text, changed?.get(f.path));
      }),
    );
    files.push(...batch.filter((f): f is RepositoryFile => !!f && f.lines.length > 0));
  }
  let contextRemaining = 90000;
  for (const file of files) {
    const originalCount = file.lines.length;
    file.lines = file.lines.filter((line) => {
      const cost = sourceLine(file.path, line.number, line.text).length + 1;
      if (cost > contextRemaining) return false;
      contextRemaining -= cost;
      return true;
    });
    if (file.lines.length !== originalCount) file.partial = true;
  }
  for (let i = files.length - 1; i >= 0; i--) if (!files[i].lines.length) files.splice(i, 1);
  if (!files.length)
    throw new HttpError(
      422,
      "분석할 공개 소스가 없습니다. 지원하는 코드 파일이 포함된 저장소나 추가된 코드가 있는 PR을 입력해 주세요.",
    );
  const repository: RepositorySnapshot = {
    ...target,
    commit,
    totalFiles: target.pullRequest ? changedCount : blobs.length,
    eligibleFiles: eligible.length,
    truncatedTree: tree.truncated || changedCount > 100,
    omittedFiles: Math.max(0, (target.pullRequest ? changedCount : blobs.length) - files.length),
    files,
    links: importLinks(files),
  };
  return {
    url: `https://github.com/${target.name}${target.pullRequest ? `/pull/${target.pullRequest}` : ""}`,
    title: target.name,
    fetchedAt: new Date().toISOString(),
    source: "repository",
    limited: true,
    repository,
    text: files.flatMap((f) => f.lines.map((l) => sourceLine(f.path, l.number, l.text))).join("\n"),
    collectionNote: `${target.pullRequest ? `PR #${target.pullRequest}의 추가·변경 줄 주변` : "기본 브랜치"}에서 커밋 ${commit.slice(0, 7)} 기준으로 읽었습니다. 목록 ${repository.totalFiles}개 중 ${files.length}개 파일의 제한된 발췌입니다. 코드 실행, 전체 호출 경로와 배포 상태는 확인하지 않았습니다. 비밀 설정·바이너리·큰 파일은 제외합니다.${repository.truncatedTree ? " 파일 목록도 일부만 수집했습니다." : ""}`,
  };
}

/** Retry-After takes precedence; GitHub reset is an epoch timestamp in seconds. */
export function githubRetryDelay(headers: Headers, now = Date.now()): number | undefined {
  const raw = headers.get("retry-after");
  const retry = raw ? (/^\d+$/.test(raw) ? Number(raw) : (Date.parse(raw) - now) / 1000) : NaN;
  const reset = Number(headers.get("x-ratelimit-reset")) * 1000;
  const seconds = Number.isFinite(retry) ? retry : (reset - now) / 1000;
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined;
}
