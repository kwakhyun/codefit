import type { Check } from "../project-check/types";
import type {
  TrainingInput,
  TrainingRecord,
  TrainingView,
  Submission,
} from "../project-learning/types";
import { missionById } from "../learn/catalog";
import { readLearning, validLearning } from "../learn/progress";
import type { Query } from "./store-queries";
import { LearningStore } from "./learning-store";
import {
  createCurriculumSnapshot,
  readCurriculumSnapshot,
  type CurriculumSnapshot,
} from "./project-curriculum";
import { HttpError } from "./http";
type StoredTraining = TrainingRecord & { curriculum?: CurriculumSnapshot };
type Review = NonNullable<Check["review"]> & { training?: StoredTraining };
const fresh = (): TrainingRecord => ({ version: 1, revision: 0, modules: {} });
export class ProjectLearningStore {
  constructor(private query: Query) {}
  private async review(owner: string, id: string) {
    const [row] = await this.query(
      "SELECT r.result,p.result AS project FROM jobs r JOIN jobs p ON p.id=? AND p.owner=r.owner AND p.kind='project-analysis' AND p.state='done' WHERE r.id=? AND r.owner=? AND r.kind=? AND r.state='done'",
      [id, `project-review-${id}`, owner, `project-review:${id}`],
    );
    if (!row) throw new HttpError(404, "답변 평가를 마친 본인 프로젝트에서 시작해 주세요.");
    return {
      raw: String(row.result),
      review: JSON.parse(String(row.result)) as Review,
      project: JSON.parse(String(row.project)) as Check,
    };
  }
  private async preparedReview(owner: string, id: string) {
    // Pin questions before returning them. If two tabs open together, the loser
    // reloads the winning snapshot rather than returning its own curriculum.
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await this.review(owner, id);
      const training = current.review.training ?? fresh();
      if (training.version !== 1) throw new HttpError(409, "학습 기록 버전을 확인할 수 없습니다.");
      if (current.review.training && "curriculum" in current.review.training) {
        const curriculum = readCurriculumSnapshot(current.review.training.curriculum);
        return { ...current, training, curriculum };
      }
      const curriculum = createCurriculumSnapshot();
      // Pre-snapshot v1 records were authored against this exact curriculum.
      // If it has since changed, do not silently reinterpret their answers.
      if (
        Object.keys(training.modules).length &&
        curriculum.contentId !== "6983bc2c9faa3434428b0570d406268999f179512e610df29fbaa8ac3e39d67f"
      )
        throw new HttpError(
          409,
          "이전 학습 기록의 문항 기준을 확인할 수 없습니다. 기존 답변은 보존했습니다.",
        );
      const pinned = { ...training, curriculum };
      const rows = await this.query(
        "UPDATE jobs SET result=? WHERE id=? AND owner=? AND kind=? AND state='done' AND result=? RETURNING id",
        [
          JSON.stringify({ ...current.review, training: pinned }),
          `project-review-${id}`,
          owner,
          `project-review:${id}`,
          current.raw,
        ],
      );
      if (rows.length) {
        const review = { ...current.review, training: pinned };
        return { ...current, raw: JSON.stringify(review), review, training: pinned, curriculum };
      }
    }
    throw new HttpError(409, "다른 화면에서 기록이 변경됐습니다. 다시 불러와 주세요.");
  }
  private async practice(owner: string, missionId: string) {
    const progress = await new LearningStore(this.query).get(owner, missionId);
    const record = readLearning(progress?.code);
    const mission = missionById(missionId)!;
    return {
      completed: record.completed && validLearning(mission, record),
      revision: progress?.codeRevision ?? null,
      hints: record.hints,
    };
  }
  async get(owner: string, id: string): Promise<TrainingView> {
    const { review, project, training, curriculum } = await this.preparedReview(owner, id);
    const learningModules = curriculum.modules;
    if (training.version !== 1) throw new HttpError(409, "학습 기록 버전을 확인할 수 없습니다.");
    const modules = await Promise.all(
      learningModules.map(async (m) => {
        const questionIndex = project.analysis.questions.findIndex((q) => q.area === m.area);
        const feedback = review.assessment.feedback.find((f) => f.questionIndex === questionIndex);
        const practice = await this.practice(owner, m.missionId);
        const record = training.modules[m.id];
        const phase = record?.transfer
          ? ("complete" as const)
          : record?.baseline
            ? practice.completed
              ? ("transfer" as const)
              : ("practice" as const)
            : ("baseline" as const);
        const mission = missionById(m.missionId)!;
        // No answer keys or baseline correctness until BOTH first submissions are locked.
        const { correct: _correct, ...baseline } = record?.baseline ?? ({} as Submission);
        void _correct;
        const publicProbes = (items: typeof m.baseline) =>
          items.map(({ answer: _a, explanation: _e, ...p }) => {
            void _a;
            void _e;
            return p;
          });
        return {
          id: m.id,
          area: m.area,
          title: m.title,
          objective: m.objective,
          missionId: m.missionId,
          level: feedback?.level ?? 0,
          reason: feedback?.feedback ?? "이번 설명에서 확인할 근거가 부족했습니다.",
          missionTitle: mission.title,
          minutes: mission.minutes,
          practiceCompleted: practice.completed,
          phase,
          probes:
            phase === "baseline"
              ? publicProbes(m.baseline)
              : phase === "transfer"
                ? publicProbes(m.transfer)
                : [],
          ...(record?.baseline ? { baseline } : {}),
          ...(record?.baseline && record.transfer
            ? {
                result: {
                  baseline: record.baseline,
                  transfer: record.transfer,
                  keys: {
                    baseline: m.baseline.map(({ answer, explanation }) => ({
                      answer,
                      explanation,
                    })),
                    transfer: m.transfer.map(({ answer, explanation }) => ({
                      answer,
                      explanation,
                    })),
                  },
                  probes: {
                    baseline: publicProbes(m.baseline),
                    transfer: publicProbes(m.transfer),
                  },
                },
              }
            : {}),
        };
      }),
    );
    // Stable ties follow the authored curriculum. AI feedback is a recommendation signal, not mastery.
    modules.sort(
      (a, b) =>
        a.level - b.level ||
        learningModules.findIndex((m) => m.id === a.id) -
          learningModules.findIndex((m) => m.id === b.id),
    );
    return { version: 1, revision: training.revision, contentId: curriculum.contentId, modules };
  }
  async submit(owner: string, input: TrainingInput) {
    const { raw, review, training, curriculum } = await this.preparedReview(owner, input.id);
    const m = curriculum.modules.find((m) => m.id === input.moduleId)!;
    const record = training.modules[m.id] ?? {};
    const existing = record[input.phase];
    if (existing) {
      if (
        JSON.stringify(existing.answers) === JSON.stringify(input.answers) &&
        existing.confidence === input.confidence &&
        existing.assisted === input.assisted
      )
        return this.get(owner, input.id);
      throw new HttpError(
        409,
        "이 단계의 첫 답변이 이미 저장됐습니다. 기록을 새로 불러와 확인해 주세요.",
      );
    }
    if (training.version !== 1 || input.revision !== training.revision)
      throw new HttpError(
        409,
        "다른 화면에서 학습 기록이 바뀌었습니다. 기록을 새로 불러온 뒤 답변을 확인해 주세요.",
      );
    const practice = await this.practice(owner, m.missionId);
    if (input.phase === "transfer" && (!record.baseline || !practice.completed))
      throw new HttpError(409, "시작 전 질문과 연결된 실습을 먼저 마쳐 주세요.");
    const submission: Submission = {
      answers: input.answers,
      confidence: input.confidence,
      assisted: input.assisted,
      correct: m[input.phase].filter((p, i) => p.answer === input.answers[i]).length,
      submittedAt: new Date().toISOString(),
      priorPractice:
        input.phase === "baseline" ? practice.completed : record.baseline!.priorPractice,
      practiceRevision: practice.revision,
      practiceHints: practice.hints,
    };
    const next: StoredTraining = {
      ...training,
      curriculum,
      version: 1,
      revision: training.revision + 1,
      modules: { ...training.modules, [m.id]: { ...record, [input.phase]: submission } },
    };
    // Atomic compare-and-swap on the existing owned review: no schema migration and no orphan
    // training rows. A concurrent deletion removes this same row; a concurrent edit cannot overwrite it.
    const rows = await this.query(
      "UPDATE jobs SET result=? WHERE id=? AND owner=? AND kind=? AND state='done' AND result=? RETURNING id",
      [
        JSON.stringify({ ...review, training: next }),
        `project-review-${input.id}`,
        owner,
        `project-review:${input.id}`,
        raw,
      ],
    );
    if (!rows.length)
      throw new HttpError(
        409,
        "다른 화면에서 기록이 변경되거나 삭제됐습니다. 기록을 다시 확인해 주세요.",
      );
    return this.get(owner, input.id);
  }
}
