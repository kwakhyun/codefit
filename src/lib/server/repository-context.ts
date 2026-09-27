import { sourceLine, type RepositoryFile } from "../project-check/repository";

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
        for (const line of lines) {
          const last = sections.at(-1);
          if (!last || last.at(-1)!.number + 1 !== line.number || !last.at(-1)!.text.trim())
            sections.push([line]);
          else last.push(line);
        }
        for (const section of sections) {
          if (cost(section) <= allowance / 2) groups.push(section);
          else
            for (let i = 0; i < section.length; i += width)
              groups.push(section.slice(i, i + width));
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
        for (const at of [...new Set(order)]) {
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
