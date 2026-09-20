import { z } from "zod";
export interface RepositoryFile {
  path: string;
  lines: { number: number; text: string }[];
  totalLines: number;
  partial: boolean;
  changed?: boolean;
}
export interface RepositorySnapshot {
  name: string;
  url?: string;
  commit: string;
  pullRequest?: number;
  totalFiles: number;
  eligibleFiles: number;
  truncatedTree: boolean;
  omittedFiles: number;
  files: RepositoryFile[];
  links: { from: string; to: string }[];
}
export function sourceLine(file: string, number: number, text: string) {
  return `${file}:L${number} ${text}`;
}
export function repositoryCitation(repo: RepositorySnapshot | undefined, evidence: string) {
  if (!repo || !evidence.trim()) return undefined;
  for (const file of repo.files) {
    const line = file.lines.find(
      (l) =>
        evidence.startsWith(`${file.path}:L${l.number} `) &&
        sourceLine(file.path, l.number, l.text).includes(evidence),
    );
    if (line)
      return {
        file,
        line: line.number,
        url: repositoryFileUrl(repo, file.path, line.number),
      };
  }
}

const repositoryPath = z
  .string()
  .min(1)
  .max(500)
  .refine(
    (p) => !/[\\\x00-\x1f]/.test(p) && p.split("/").every((s) => s && s !== "." && s !== ".."),
  );
export const repositorySnapshotSchema = z
  .object({
    name: repositoryPath,
    url: z
      .url()
      .refine((v) => {
        const u = new URL(v);
        return u.protocol === "https:" && !u.username && !u.password && !u.search && !u.hash;
      })
      .optional(),
    commit: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
    pullRequest: z.number().int().positive().optional(),
    totalFiles: z.number().int().nonnegative(),
    eligibleFiles: z.number().int().nonnegative(),
    truncatedTree: z.boolean(),
    omittedFiles: z.number().int().nonnegative(),
    files: z
      .array(
        z
          .object({
            path: repositoryPath,
            lines: z
              .array(
                z
                  .object({ number: z.number().int().positive(), text: z.string().max(400) })
                  .strict(),
              )
              .max(6501),
            totalLines: z.number().int().nonnegative(),
            partial: z.boolean(),
            changed: z.boolean().optional(),
          })
          .strict(),
      )
      .max(16),
    links: z.array(z.object({ from: repositoryPath, to: repositoryPath }).strict()).max(256),
  })
  .strict();

function repositoryFileUrl(repo: RepositorySnapshot, path: string, line: number) {
  const base = repo.url
    ? repo.url.replace(/\.git$/, "").replace(/\/$/, "")
    : `https://github.com/${repo.name}`;
  const host = new URL(base).hostname;
  const file = path.split("/").map(encodeURIComponent).join("/");
  if (host === "github.com") return `${base}/blob/${repo.commit}/${file}#L${line}`;
  if (host === "gitlab.com" || host.startsWith("gitlab."))
    return `${base}/-/blob/${repo.commit}/${file}#L${line}`;
  if (host === "bitbucket.org") return `${base}/src/${repo.commit}/${file}#lines-${line}`;
  if (host === "codeberg.org") return `${base}/src/commit/${repo.commit}/${file}#L${line}`;
  return base;
}
