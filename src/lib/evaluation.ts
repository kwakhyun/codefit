export interface EvaluationCaseResult {
  id: string;
  category: string;
  expected: boolean[];
  actual: boolean[] | null;
  latencyMs: number;
}
export function percentile(values: number[], fraction: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}
export function evaluationSummary(results: EvaluationCaseResult[]) {
  const completed = results.filter((r) => r.actual !== null);
  const negatives = completed.filter((r) => !r.expected.every(Boolean));
  const positives = completed.filter((r) => r.expected.every(Boolean));
  const falsePasses = negatives.filter((r) => r.actual!.every(Boolean)).length;
  const falseRejects = positives.filter((r) => !r.actual!.every(Boolean)).length;
  const criteriaCount = completed.reduce((sum, r) => sum + r.expected.length, 0);
  const criteriaMatched = completed.reduce(
    (sum, r) => sum + r.expected.filter((value, i) => r.actual![i] === value).length,
    0,
  );
  return {
    total: results.length,
    completed: completed.length,
    errors: results.length - completed.length,
    agreement: completed.length
      ? (completed.length - falsePasses - falseRejects) / completed.length
      : null,
    negativeCases: negatives.length,
    positiveCases: positives.length,
    falsePasses,
    falseRejects,
    falsePassRate: negatives.length ? falsePasses / negatives.length : null,
    criterionAgreement: criteriaCount ? criteriaMatched / criteriaCount : null,
    criteriaCount,
    criteriaMatched,
    latencyP50Ms: percentile(
      completed.map((r) => r.latencyMs),
      0.5,
    ),
    latencyP95Ms: percentile(
      completed.map((r) => r.latencyMs),
      0.95,
    ),
  };
}
