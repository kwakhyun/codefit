import { HttpError } from "./http";
import { createHash } from "node:crypto";
import { z } from "zod";
import { sourceLine, type RepositorySnapshot } from "../project-check/repository";
import {
  practiceGuidanceSchema,
  serviceScenarioSchema,
  projectExercisesSchema,
} from "../project-check/generated-practice";
import { workshopPlanSchema } from "../ai-learning/project-workshop";

/** Only server-issued IDs can be cited; the model never writes paths or line numbers. */
export function learningEvidence(repository: RepositorySnapshot) {
  const reserved = new Set(
    repository.files.flatMap((file) =>
      file.lines.flatMap((line) => line.text.match(/CFREF_\d+/g) ?? []),
    ),
  );
  let sequence = 0;
  const nextId = () => {
    do {
      sequence++;
    } while (reserved.has(`CFREF_${sequence}`));
    return `CFREF_${sequence}`;
  };
  const snippets: { id: string; file: string; code: string; evidence: string }[] = [];
  for (const file of repository.files) {
    const groups: (typeof file.lines)[] = [];
    for (const line of file.lines) {
      const group = groups.at(-1);
      const cost = (group ?? []).reduce(
        (n, l) => n + sourceLine(file.path, l.number, l.text).length + 1,
        0,
      );
      if (
        !group ||
        group.length >= 12 ||
        group.at(-1)!.number + 1 !== line.number ||
        cost + sourceLine(file.path, line.number, line.text).length > 800
      )
        groups.push([line]);
      else group.push(line);
    }
    // Preserve the entire cited block, not an arbitrary representative line.
    // Every collected branch remains available; do not sample away later blocks.
    for (const [index, group] of groups.entries()) {
      const lines = [...group];
      // Overlap adjacent blocks so a final guard and its return value stay visible.
      for (const line of (groups[index + 1] ?? []).slice(0, 4)) {
        const cost = [...lines, line]
          .map((l) => sourceLine(file.path, l.number, l.text))
          .join("\n").length;
        if (line.number !== lines.at(-1)!.number + 1 || cost > 1100) break;
        lines.push(line);
      }
      // If the boundary lands immediately before a return, keep that outcome
      // with the guard. Trim leading context rather than the decisive tail.
      const next = file.lines.findIndex((line) => line.number === lines.at(-1)!.number + 1);
      if (next >= 0 && /^\s*return\b/.test(file.lines[next].text)) {
        for (const line of file.lines.slice(next, next + 3)) {
          if (line.number !== lines.at(-1)!.number + 1) break;
          lines.push(line);
        }
        while (
          lines.length > 1 &&
          lines.map((l) => sourceLine(file.path, l.number, l.text)).join("\n").length > 1100
        )
          lines.shift();
      }
      snippets.push({
        id: nextId(),
        file: file.path,
        code: lines.map((l) => `${l.number}: ${l.text}`).join("\n"),
        evidence: lines.map((l) => sourceLine(file.path, l.number, l.text)).join("\n"),
      });
    }
  }
  if (!snippets.length) throw new HttpError(422, "학습에 사용할 코드 근거가 없습니다.");
  const byId = new Map(snippets.map((s) => [s.id, s.evidence]));
  function cleanText<T>(value: T): T {
    const visit = (item: unknown): unknown => {
      if (typeof item === "string")
        return item
          .replace(/\((?:CFREF_\d+[ ,]*)+\)/g, (match) =>
            [...match.matchAll(/CFREF_\d+/g)].every(([id]) => byId.has(id)) ? "" : match,
          )
          .replace(
            /(?<![A-Za-z0-9_])CFREF_\d+(은|는|이|가|을|를|과|와)?(?![A-Za-z0-9_])/g,
            (match, particle: string | undefined) => {
              const id = /^CFREF_\d+/.exec(match)![0];
              if (!byId.has(id)) return match;
              const suffix = particle
                ? (
                    {
                      은: "는",
                      는: "는",
                      이: "가",
                      가: "가",
                      을: "를",
                      를: "를",
                      과: "와",
                      와: "와",
                    } as Record<string, string>
                  )[particle]
                : "";
              return `인용한 코드${suffix}`;
            },
          );
      if (Array.isArray(item)) return item.map(visit);
      if (item && typeof item === "object")
        return Object.fromEntries(
          Object.entries(item).map(([key, entry]) => [
            key,
            key === "evidence" || key === "codeEvidence" ? entry : visit(entry),
          ]),
        );
      return item;
    };
    return visit(value) as T;
  }
  const evidence = z
    .array(z.enum(snippets.map((s) => s.id)))
    .min(1)
    .max(3);
  const quiz = {
    correctChoice: z.string().trim().min(1).max(160),
    distractors: z.array(z.string().trim().min(1).max(160)).min(1).max(3),
  };
  const task = projectExercisesSchema.shape.code.element
    .omit({ choices: true, answer: true, serviceScenario: true })
    .extend({ evidence, guidance: practiceGuidanceSchema, ...quiz });
  const topic = workshopPlanSchema.shape.topics.element
    .omit({ choices: true, answer: true })
    .extend({ evidence, ...quiz });
  function resolve<
    T extends {
      question: string;
      evidence: string[];
      correctChoice: string;
      distractors: string[];
    },
  >(value: T) {
    const { correctChoice, distractors, ...rest } = cleanText(value);
    if (new Set([correctChoice, ...distractors]).size !== distractors.length + 1)
      throw new HttpError(502, "학습 문제의 선택지가 중복되었습니다. 다시 생성해 주세요.");
    // The server derives the index from the correct text, avoiding one/zero-based mistakes.
    const answer =
      createHash("sha256").update(value.question).digest()[0] % (distractors.length + 1);
    const choices = [...distractors];
    choices.splice(answer, 0, correctChoice);
    return {
      ...rest,
      choices,
      answer,
      evidence: value.evidence.map((id) => {
        const source = byId.get(id);
        if (!source)
          throw new HttpError(
            502,
            "학습 내용의 코드 근거를 확인하지 못했습니다. 다시 생성해 주세요.",
          );
        return source;
      }),
    };
  }
  return {
    cleanText,
    evidenceIdSchema: z.enum([...snippets.map((s) => s.id), ""]),
    resolveEvidence: (id: string) => {
      const source = byId.get(id);
      if (!source)
        throw new HttpError(
          502,
          "학습 내용의 코드 근거를 확인하지 못했습니다. 다시 생성해 주세요.",
        );
      return source;
    },
    snippets: snippets.map(({ id, file, code }) => ({ id, file, code })),
    practiceSchema: z
      .object({
        code: z.array(task).length(3),
        service: z.array(task.extend({ serviceScenario: serviceScenarioSchema })).length(3),
      })
      .strict(),
    workshopSchema: workshopPlanSchema.extend({ topics: z.array(topic).max(6) }),
    resolve,
  };
}
