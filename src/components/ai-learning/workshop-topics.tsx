"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AI_LESSONS } from "@/lib/ai-learning/catalog";
import type { ProjectWorkshop, WorkshopPlan } from "@/lib/ai-learning/project-workshop";
import type { Check } from "@/lib/project-check/types";
import { api, errorMessage } from "@/lib/client-api";
import {
  AppLink,
  Button,
  Card,
  Disclosure,
  DisclosureSummary,
  FieldLabel,
  Input,
  Textarea,
} from "@/components/ui/primitives";
import { PracticeSources } from "@/components/project-practice/practice-sources";
export function WorkshopTopics({
  check,
  saved,
  scope,
  onSaved,
}: {
  check: Check;
  saved: ProjectWorkshop;
  scope: string;
  onSaved: (v: ProjectWorkshop) => void;
}) {
  const params = useSearchParams();
  const requested = Number(params.get("topic") ?? -1);
  const initial =
    Number.isInteger(requested) && requested >= 0 && requested < saved.plan.topics.length
      ? requested
      : null;
  const [kind, setKind] = useState<"observed" | "proposed">(
    initial !== null
      ? saved.plan.topics[initial].kind
      : saved.plan.topics.some((t) => t.kind === "observed")
        ? "observed"
        : "proposed",
  );
  const [selected, setSelected] = useState<number | null>(initial);
  const topics = saved.plan.topics
    .map((topic, index) => ({ topic, index }))
    .filter((t) => t.topic.kind === kind);
  const active = topics.find((t) => t.index === selected) || topics[0];
  return (
    <div className="project-ai-plan">
      <Card className="project-ai-summary">
        <h2>내 프로젝트에서 배울 AI</h2>
        <p>{saved.plan.summary}</p>
        <Disclosure>
          <DisclosureSummary>분석 범위와 확인하지 못한 내용</DisclosureSummary>
          <p className="muted">{saved.plan.limitations}</p>
        </Disclosure>
        <small>
          정적 코드 일부를 바탕으로 만든 학습 자료입니다. 설치, 실행 또는 적용 완료를 뜻하지
          않습니다.
        </small>
      </Card>
      <div className="project-ai-switch" role="group" aria-label="프로젝트 AI 학습 종류">
        {(
          [
            ["observed", "코드에서 확인한 AI"],
            ["proposed", "새로 적용해 볼 AI"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            aria-pressed={kind === value}
            onClick={() => {
              setKind(value);
              setSelected(null);
            }}
          >
            {label} <span>{saved.plan.topics.filter((t) => t.kind === value).length}</span>
          </Button>
        ))}
      </div>
      {!active ? (
        <Card>
          <h3>
            {kind === "observed"
              ? "수집한 코드에서 AI 사용을 확인하지 못했어요"
              : "지금 추가할 도구를 제안하지 않았어요"}
          </h3>
          <p>
            {kind === "observed"
              ? "전체 저장소에 AI가 없다는 뜻은 아닙니다. 적용 아이디어를 살펴보거나 일반 수업에서 필요한 개념을 찾아보세요."
              : "도구를 늘리는 것보다 현재 흐름을 유지하는 편이 적합할 수 있습니다. 분석 범위 밖의 요구사항은 별도로 확인해 주세요."}
          </p>
        </Card>
      ) : (
        <>
          <div className="project-ai-topic-list" role="group" aria-label="학습 주제 선택">
            {topics.map(({ topic, index }) => (
              <Button
                key={index}
                aria-pressed={active.index === index}
                onClick={() => setSelected(index)}
              >
                <span>
                  {saved.responses[index]
                    ? saved.responses[index]?.choice === topic.answer
                      ? "✓ "
                      : "답변 저장 · "
                    : ""}
                  {topic.title}
                </span>
                <small>{topic.tool}</small>
              </Button>
            ))}
          </div>
          <TopicDetail
            key={active.index}
            check={check}
            topic={active.topic}
            index={active.index}
            saved={saved}
            scope={scope}
            onSaved={onSaved}
          />
        </>
      )}
    </div>
  );
}
function TopicDetail({
  check,
  topic,
  index,
  saved,
  scope,
  onSaved,
}: {
  check: Check;
  topic: WorkshopPlan["topics"][number];
  index: number;
  saved: ProjectWorkshop;
  scope: string;
  onSaved: (v: ProjectWorkshop) => void;
}) {
  const response = saved.responses[index];
  const [choice, setChoice] = useState<number | null>(response?.choice ?? null);
  const [note, setNote] = useState(response?.note || "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function save() {
    if (busy || choice === null) return;
    setBusy(true);
    setError("");
    try {
      onSaved(
        await api<ProjectWorkshop>(`/api/project-check/${check.id}/workshop`, {
          method: "PATCH",
          scope,
          body: { index, revision: saved.revision, response: { choice, note } },
        }),
      );
      setNotice("답변과 적용 기록을 저장했습니다.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    setBusy(true);
    try {
      const latest = await api<ProjectWorkshop>(`/api/project-check/${check.id}/workshop`, {
        scope,
      });
      onSaved(latest);
      setError("");
      setNotice("서버 기록을 불러왔습니다. 현재 작성 내용은 유지했으니 비교 후 저장해 주세요.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="project-ai-topic">
      <header>
        <span className="eyebrow">
          {topic.kind === "observed" ? "사용 근거가 있는 기술" : "아직 적용하지 않은 아이디어"} /{" "}
          {topic.tool}
        </span>
        <h2>{topic.title}</h2>
        <p>{topic.purpose}</p>
      </header>
      <section>
        <h3>01 내 코드와 연결해 이해하기</h3>
        <p>{topic.explanation}</p>
        <PracticeSources
          repository={check.page.repository!}
          evidence={topic.evidence}
          expanded={false}
        />
      </section>
      <section>
        <h3>02 필요한 개념 배우기</h3>
        <p className="muted">
          연결된 수업에서 개념과 모의 실습을 익힌 뒤 이 프로젝트로 돌아오세요.
        </p>
        <div className="project-ai-lessons">
          {topic.lessonIds.map((id) => (
            <AppLink key={id} href={`/learn/ai/${id}?project=${check.id}&topic=${index}`}>
              {AI_LESSONS.find((l) => l.id === id)!.title} →
            </AppLink>
          ))}
        </div>
      </section>
      <section>
        <h3>
          {topic.kind === "observed" ? "03 기존 동작을 확인하는 실험" : "03 작게 적용해 보는 실험"}
        </h3>
        <ol className="practice-walkthrough">
          {topic.steps.map((s, i) => (
            <li key={i}>
              <strong>{s.action}</strong>
              <p>{s.expected}</p>
            </li>
          ))}
        </ol>
        <div className="practice-scenario">
          <h4>도입 전에 비교할 점</h4>
          <p>{topic.tradeoff}</p>
          <h4>이 결과를 확인하세요</h4>
          <p>{topic.verification}</p>
        </div>
      </section>
      <section>
        <h3>04 내 프로젝트에 적용해 설명하기</h3>
        <fieldset disabled={busy}>
          <legend>{topic.question}</legend>
          {topic.choices.map((v, i) => (
            <label className="practice-answer" key={i}>
              <Input
                type="radio"
                name={`workshop-${index}`}
                checked={choice === i}
                onChange={() => {
                  setChoice(i);
                  setNotice("");
                }}
              />
              {v}
            </label>
          ))}
        </fieldset>
        {response && (
          <div className="practice-scenario">
            <h4>
              {response.choice === topic.answer
                ? "판단의 기준을 잘 짚었어요"
                : "이 판단 기준을 다시 살펴보세요"}
            </h4>
            <p>{topic.feedback}</p>
            <p>권장 선택: {topic.choices[topic.answer]}</p>
          </div>
        )}
        <FieldLabel htmlFor="workshop-note">
          내 적용 계획 또는 확인 기록 <span className="muted">선택</span>
        </FieldLabel>
        <Textarea
          id="workshop-note"
          rows={4}
          maxLength={2000}
          value={note}
          disabled={busy}
          onChange={(e) => {
            setNote(e.target.value);
            setNotice("");
          }}
          placeholder="무엇을 바꾸고 어떤 결과를 확인할지 적어보세요. 실행 전이라면 ‘확인 예정’으로 남겨주세요."
        />
        <p className="muted">
          기록은 직접 저장해야 합니다. 실행 결과나 실제 적용 여부를 자동 검증하지 않습니다.
        </p>
        <Button className="primary-button" onClick={save} disabled={busy || choice === null}>
          {busy ? "저장 중…" : response ? "답변과 기록 수정 저장" : "답변 확인하고 기록 저장"}
        </Button>
        {notice && <p role="status">{notice}</p>}
        {error && (
          <div role="alert">
            <p>{error}</p>
            <Button disabled={busy} onClick={reload}>
              저장된 기록 다시 불러오기
            </Button>
          </div>
        )}
      </section>
    </Card>
  );
}
