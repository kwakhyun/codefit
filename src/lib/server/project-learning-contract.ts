import { HttpError } from "./http";
import { createHash } from "node:crypto";
import { z } from "zod";
import { sourceLine, type RepositorySnapshot } from "../project-check/repository";
import { projectExercisesSchema } from "../project-check/generated-practice";
import { workshopPlanSchema } from "../ai-learning/project-workshop";

/** Only server-issued IDs can be cited; the model never writes paths or line numbers. */
export function learningEvidence(repository: RepositorySnapshot) {
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
        group.length >= 16 ||
        group.at(-1)!.number + 1 !== line.number ||
        cost + sourceLine(file.path, line.number, line.text).length > 1100
      )
        groups.push([line]);
      else group.push(line);
    }
    // Preserve the entire cited block, not an arbitrary representative line.
    // Every collected branch remains available; do not sample away later blocks.
    for (const lines of groups) {
      snippets.push({
        id: `E${snippets.length + 1}`,
        file: file.path,
        code: lines.map((l) => `${l.number}: ${l.text}`).join("\n"),
        evidence: lines.map((l) => sourceLine(file.path, l.number, l.text)).join("\n"),
      });
    }
  }
  if (!snippets.length) throw new HttpError(422, "학습에 사용할 코드 근거가 없습니다.");
  const byId = new Map(snippets.map((s) => [s.id, s.evidence]));
  const evidence = z
    .array(z.enum(snippets.map((s) => s.id)))
    .min(1)
    .max(3);
  const quiz = {
    correctChoice: z.string().trim().min(1).max(160),
    distractors: z.array(z.string().trim().min(1).max(160)).min(1).max(3),
  };
  const task = projectExercisesSchema.shape.code.element
    .omit({ choices: true, answer: true })
    .extend({ evidence, ...quiz });
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
    const { correctChoice, distractors, ...rest } = value;
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
      .object({ code: z.array(task).length(3), service: z.array(task).length(3) })
      .strict(),
    workshopSchema: workshopPlanSchema.extend({ topics: z.array(topic).max(6) }),
    resolve,
  };
}
