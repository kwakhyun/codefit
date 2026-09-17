import { HANDOFF_FIELDS, readHandoffDraft, formatTraining } from "./draft";

/** A local draft artifact, never represented as verified production documentation. */
export function handoffDocument(title: string, value: string) {
  const { implementation, notes, training } = readHandoffDraft(value);
  const longest = Math.max(2, ...(implementation.match(/`+/g) ?? []).map((s) => s.length));
  const fence = "`".repeat(longest + 1);
  return (
    [
      `# ${title} — 인수인계 초안`,
      "작성 중인 코드와 메모를 내보낸 문서입니다. AI 승인이나 실행 검증을 의미하지 않습니다.",
      "## 구현 코드",
      `${fence}javascript\n${implementation}\n${fence}`,
      ...(training
        ? [
            `## 훈련 기록\n\n${formatTraining(training)}\n\n브라우저 실행 기록이며 서버가 인증한 성적이 아닙니다.`,
          ]
        : []),
      ...HANDOFF_FIELDS.map((f) => `## ${f.label}\n\n${notes[f.key] || "미작성"}`),
    ].join("\n\n") + "\n"
  );
}
