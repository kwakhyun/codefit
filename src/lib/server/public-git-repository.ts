import { boundRepositoryContext } from "./repository-context";
import { Sandbox } from "@vercel/sandbox";
import { z } from "zod";
import { publicUrl } from "./project-page";
import { browserNetworkPolicy } from "./project-browser";
import {
  eligibleSource,
  extractSource,
  importLinks,
  repositorySourcePolicy,
} from "./project-repository";
import { sourceLine, type RepositorySnapshot } from "../project-check/repository";
import type { PageSnapshot } from "../project-check/types";
import { HttpError } from "./http";

/** Accept any public HTTPS Git origin, including self-hosted forges. */
export function publicGitTarget(raw: string) {
  const url = publicUrl(raw.trim());
  const name = decodeURIComponent(url.pathname)
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.git$/, "");
  if (
    !name ||
    name.length > 500 ||
    name.split("/").some((p) => !p || p === "." || p === "..") ||
    /[\x00-\x20\\]/.test(name)
  )
    throw new HttpError(400, "공개 저장소의 루트 주소 또는 HTTPS 복제 주소를 입력해 주세요.");
  if (/\/(?:-|src|tree|blob|pull|pulls|pull-requests|merge_requests)\//.test(url.pathname))
    throw new HttpError(
      400,
      "파일이나 변경 요청 화면 대신 저장소 루트 또는 HTTPS 복제 주소를 입력해 주세요. GitHub PR은 별도로 지원합니다.",
    );
  return { url: url.href.replace(/\/$/, ""), name, hostname: url.hostname };
}
export function looksLikeRepository(raw: string) {
  const url = publicUrl(raw);
  return (
    ["github.com", "gitlab.com", "bitbucket.org", "codeberg.org", "git.sr.ht"].includes(
      url.hostname,
    ) || /\.git\/?$/.test(url.pathname)
  );
}
const collectedSchema = z.object({
  commit: z.string().regex(/^[a-f0-9]{40,64}$/),
  total: z.number().int().nonnegative().max(50000),
  files: z
    .array(
      z.object({
        path: z.string().max(500),
        mode: z.enum(["100644", "100755"]).optional(),
        text: z.string().max(100000),
      }),
    )
    .max(16),
});

/** Only our reader runs. No checkout, hooks, submodules, installs or target code execution. */
export async function readPublicGitRepository(
  raw: string,
  outer: AbortSignal,
): Promise<PageSnapshot> {
  const target = publicGitTarget(raw);
  const signal = AbortSignal.any([outer, AbortSignal.timeout(45_000)]);
  let sandbox: Sandbox;
  try {
    sandbox = await Sandbox.create({
      runtime: "node24",
      persistent: false,
      timeout: 48_000,
      networkPolicy: { ...browserNetworkPolicy, allow: [target.hostname] },
      signal,
    });
  } catch {
    throw new HttpError(
      503,
      "저장소를 읽을 연결을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요. AI 분석 횟수는 차감되지 않았습니다.",
    );
  }
  try {
    const ipv6 = await sandbox.runCommand({
      cmd: "sysctl",
      args: ["-w", "net.ipv6.conf.all.disable_ipv6=1", "net.ipv6.conf.default.disable_ipv6=1"],
      sudo: true,
      signal,
    });
    if (ipv6.exitCode !== 0) throw new Error("network restriction");
    await sandbox.writeFiles(
      [
        { path: "/vercel/sandbox/target.json", content: Buffer.from(JSON.stringify(target)) },
        { path: "/vercel/sandbox/read.mjs", content: Buffer.from(gitReaderScript) },
      ],
      { signal },
    );
    const command = await sandbox.runCommand({
      cmd: "node",
      args: ["/vercel/sandbox/read.mjs"],
      signal,
    });
    if (command.exitCode !== 0) throw new Error("collection");
    const output = await sandbox.readFileToBuffer(
      { path: "/vercel/sandbox/result.json" },
      { signal },
    );
    if (!output || output.length > 2_000_000) throw new Error("size");
    const result = collectedSchema.parse(JSON.parse(output.toString()));
    const candidates = result.files.filter(
      (f) => eligibleSource(f.path, f.mode) && !f.text.includes("\0"),
    );
    const files = boundRepositoryContext(candidates.map((f) => extractSource(f.path, f.text)));
    if (!files.length)
      throw new HttpError(
        422,
        "읽을 수 있는 소스 파일을 찾지 못했습니다. 지원하는 소스가 있는 공개 저장소의 루트 주소를 확인해 주세요. AI 분석 횟수는 차감되지 않았습니다.",
      );
    const repository: RepositorySnapshot = {
      name: target.name,
      url: target.url,
      commit: result.commit,
      totalFiles: result.total,
      eligibleFiles: candidates.length,
      truncatedTree: true,
      omittedFiles: Math.max(0, result.total - files.length),
      files,
      links: importLinks(files),
    };
    return {
      url: target.url,
      title: target.name,
      source: "repository",
      limited: true,
      repository,
      fetchedAt: new Date().toISOString(),
      text: files
        .flatMap((f) => f.lines.map((l) => sourceLine(f.path, l.number, l.text)))
        .join("\n"),
      collectionNote: `공개 HTTPS Git 저장소의 기본 브랜치 커밋 ${result.commit.slice(0, 7)}에서 최대 16개 소스 파일을 발췌했습니다. 인증, 코드 실행, 하위 저장소와 Git LFS 파일은 읽지 않습니다. 전체 구현이나 배포 상태를 검증한 결과가 아닙니다.`,
    };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(
      422,
      "공개 Git 소스를 읽지 못했습니다. 로그인 없이 복제할 수 있는 HTTPS 저장소 루트 주소인지 확인해 주세요. 주소가 이동했거나 저장소가 너무 크거나 서버가 수집을 차단한 경우에도 실패할 수 있습니다. AI 분석 횟수는 차감되지 않았습니다.",
    );
  } finally {
    await sandbox.stop({ signal: AbortSignal.timeout(3000) }).catch(() => {});
  }
}

export const gitReaderScript = String.raw`
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const target=JSON.parse(readFileSync('/vercel/sandbox/target.json','utf8'));
mkdirSync('/tmp/git-home',{recursive:true});
const env={PATH:process.env.PATH,HOME:'/tmp/git-home',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0',GIT_ASKPASS:'/bin/false',GIT_ALLOW_PROTOCOL:'https',GIT_LFS_SKIP_SMUDGE:'1'};
const config=['-c','core.hooksPath=/dev/null','-c','http.followRedirects=initial','-c','credential.helper=','-c','protocol.allow=never','-c','protocol.https.allow=always','-c','http.lowSpeedLimit=1024','-c','http.lowSpeedTime=10'];
const git=(args)=>execFileSync('bash',['-c','ulimit -f 65536; exec git "$@"','git',...config,...args],{cwd:'/vercel/sandbox',env,timeout:28000,maxBuffer:6000000,encoding:'utf8',stdio:['ignore','pipe','pipe']});
git(['clone','--depth=1','--single-branch','--filter=blob:none','--no-checkout','--no-recurse-submodules','--',target.url,'repo']);
const commit=git(['-C','repo','rev-parse','HEAD']).trim();
// Reading objects avoids symlinks, worktree filters and Git LFS downloads.
const entries=git(['-C','repo','ls-tree','-rz','HEAD']).split('\0').filter(Boolean);
if(entries.length>50000)throw Error('tree limit');
const safePath=(value)=>!value.split('/').some(p=>!p||p==='.'||p==='..')&&!/[\x00-\x1f\\]/.test(value);
const policy=${JSON.stringify(repositorySourcePolicy)};
const eligibleSource=(value,mode)=>safePath(value)&&!new RegExp(policy.excludedSegments,'i').test(value)&&!new RegExp(policy.excludedNames,'i').test(value)&&(new RegExp(policy.extensions,'i').test(value)||new RegExp(policy.extensionless,'i').test(value)||(mode==='100755'&&!value.split('/').at(-1).includes('.')));
const priority=(value)=>policy.priorities.find(p=>new RegExp(p.pattern,'i').test(value))?.rank??6;
const candidates=entries.flatMap(e=>{const m=/^(100644|100755) blob ([a-f0-9]{40,64})\t(.+)$/s.exec(e);return m&&eligibleSource(m[3],m[1])?[{sha:m[2],path:m[3],mode:m[1]}]:[];});
const selected=[],counts=new Map();
const group=p=>/^(apps|packages|services)\/[^/]+/.exec(p)?.[0]??p.split('/').slice(0,2).join('/');
while(candidates.length&&selected.length<16){candidates.sort((a,b)=>(priority(a.path)+Math.min(2,(counts.get(group(a.path))??0)*0.35))-(priority(b.path)+Math.min(2,(counts.get(group(b.path))??0)*0.35))||a.path.localeCompare(b.path));const next=candidates.shift();selected.push(next);counts.set(group(next.path),(counts.get(group(next.path))??0)+1);}
const files=[];
for(const file of selected){const size=Number(git(['-C','repo','cat-file','-s',file.sha]));if(size>100000)continue;const text=git(['-C','repo','cat-file','blob',file.sha]);if(!text.includes('\0'))files.push({path:file.path,mode:file.mode,text});}
writeFileSync('/vercel/sandbox/result.json',JSON.stringify({commit,total:entries.length,files}));
`;
