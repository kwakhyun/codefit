export interface CodeComparison {
  isExact: boolean;
  accuracy: number;
  firstMismatchLine: number | null;
}

export function normalizeCode(code: string): string {
  return code.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
}

function levenshteinDistance(first: string, second: string): number {
  if (first === second) return 0;
  if (first.length === 0) return second.length;
  if (second.length === 0) return first.length;

  const previous = Array.from(
    { length: second.length + 1 },
    (_, index) => index,
  );
  const current = new Array<number>(second.length + 1);

  for (let row = 1; row <= first.length; row += 1) {
    current[0] = row;

    for (let column = 1; column <= second.length; column += 1) {
      const substitutionCost =
        first[row - 1] === second[column - 1] ? 0 : 1;

      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + substitutionCost,
      );
    }

    for (let column = 0; column <= second.length; column += 1) {
      previous[column] = current[column];
    }
  }

  return previous[second.length];
}

function findFirstMismatchLine(
  reference: string,
  attempt: string,
): number | null {
  const referenceLines = reference.split("\n");
  const attemptLines = attempt.split("\n");
  const lineCount = Math.max(referenceLines.length, attemptLines.length);

  for (let index = 0; index < lineCount; index += 1) {
    if (referenceLines[index] !== attemptLines[index]) {
      return index + 1;
    }
  }

  return null;
}

export function compareCode(reference: string, attempt: string): CodeComparison {
  const normalizedReference = normalizeCode(reference);
  const normalizedAttempt = normalizeCode(attempt);
  const isExact = normalizedReference === normalizedAttempt;
  const longestLength = Math.max(
    normalizedReference.length,
    normalizedAttempt.length,
  );
  const distance = levenshteinDistance(
    normalizedReference,
    normalizedAttempt,
  );
  const accuracy =
    longestLength === 0
      ? 100
      : Math.max(0, Math.round((1 - distance / longestLength) * 100));

  return {
    isExact,
    accuracy,
    firstMismatchLine: isExact
      ? null
      : findFirstMismatchLine(normalizedReference, normalizedAttempt),
  };
}

