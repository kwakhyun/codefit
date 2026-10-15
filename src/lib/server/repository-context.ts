import { sourceLine, type RepositoryFile } from "../project-check/repository";
import { sourceStatements } from "./repository-source-statements";

/** Share the context budget so long paths or early files cannot starve later modules. */
export function boundRepositoryContext(files: RepositoryFile[], budget = 90000) {
  let remaining = budget;
  return files
    .map((file, index) => {
      const allowance = Math.floor(remaining / (files.length - index));
      const cost = (lines: RepositoryFile["lines"]) =>
        lines.reduce((n, l) => n + sourceLine(file.path, l.number, l.text).length + 1, 0);
      let lines = file.lines;
      if (cost(lines) > allowance) {
        const groups: RepositoryFile["lines"][] = [];
        const width = Math.max(
          1,
          Math.min(8, Math.floor(allowance / ((cost(lines) / lines.length) * 4))),
        );
        // Prefer contiguous paragraphs to arbitrary offsets. A short method's
        // first return and later guard must not be sampled independently.
        const sections: RepositoryFile["lines"][] = [];
        for (const statement of sourceStatements(file.path, lines)) {
          const last = sections.at(-1);
          if (!last || last.at(-1)!.number + 1 !== statement[0].number || !last.at(-1)!.text.trim())
            sections.push([...statement]);
          else last.push(...statement);
        }
        for (const section of sections) {
          if (cost(section) <= allowance / 2) groups.push(section);
          else {
            let group: RepositoryFile["lines"] = [];
            for (const statement of sourceStatements(file.path, section)) {
              if (group.length && group.length + statement.length > width) {
                groups.push(group);
                group = [];
              }
              group.push(...statement);
            }
            if (group.length) groups.push(group);
          }
        }
        const chosen: RepositoryFile["lines"] = [];
        let spent = 0;
        // Visit the start, end, and progressively smaller interior intervals.
        const queue: [number, number][] = [[0, groups.length - 1]];
        const order: number[] = [];
        while (queue.length) {
          const [lo, hi] = queue.shift()!;
          if (lo > hi) continue;
          order.push(lo);
          if (hi > lo) order.push(hi);
          const mid = Math.floor((lo + hi) / 2);
          queue.push([lo + 1, mid], [mid + 1, hi - 1]);
        }
        // Imports/types at the start and boilerplate at the end must not use
        // the whole allowance before an interior business decision is visited.
        const priority = (group: RepositoryFile["lines"]) =>
          group.some((line) =>
            /^\s*(?:if\b|switch\b|throw\b|return\b|(?:const|let)\s+\w+\s*=\s*await\b|await\b)/.test(
              line.text,
            ),
          )
            ? 0
            : group.some((line) => /\b(?:function|async)\b|=>/.test(line.text))
              ? 1
              : 2;
        const visits = [...new Set(order)];
        if (/\.[cm]?[jt]sx?$/.test(file.path))
          visits.sort((a, b) => priority(groups[a]) - priority(groups[b]));
        for (const at of visits) {
          const group = groups[at],
            size = cost(group);
          if (spent + size <= allowance) {
            chosen.push(...group);
            spent += size;
          }
        }
        lines = chosen.sort((a, b) => a.number - b.number);
      }
      remaining -= cost(lines);
      return { ...file, lines, partial: file.partial || lines.length !== file.lines.length };
    })
    .filter((file) => file.lines.length);
}
