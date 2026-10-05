"use client";
import { useId, useState } from "react";
import {
  Button,
  Card,
  Disclosure,
  DisclosureSummary,
  FieldLabel,
  Textarea,
} from "@/components/ui/primitives";
import { projectEvidenceReview, projectRepairPrompt } from "@/lib/project-check/evidence-review";
import type { Check, ProjectPractice } from "@/lib/project-check/types";
import { SourceEvidence } from "./project-repository";

export function RepairRequest({
  check,
  questionIndex,
  practice,
}: {
  check: Check;
  questionIndex: number;
  practice?: ProjectPractice;
}) {
  const id = useId();
  const [message, setMessage] = useState("");
  const prompt = projectRepairPrompt(check, questionIndex, practice);
  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setMessage("수정 요청을 복사했습니다. 사용하는 AI 코딩 도구에 붙여넣으세요.");
    } catch {
      setMessage("자동 복사를 사용할 수 없습니다. 아래 요청 내용을 선택해 복사해 주세요.");
    }
  }
  return (
    <Disclosure className="repair-request">
      <DisclosureSummary>이 항목의 AI 수정 요청 보기</DisclosureSummary>
      <p>
        코드 근거와 확인 절차를 함께 전달합니다. 실제 문제가 있는지 확인한 뒤 수정하도록 요청합니다.
      </p>
      <FieldLabel htmlFor={id}>AI에 전달할 수정 요청</FieldLabel>
      <Textarea
        id={id}
        value={prompt}
        readOnly
        rows={8}
        onFocus={(event) => event.currentTarget.select()}
      />
      <Button className="secondary-button" onClick={() => void copy()}>
        수정 요청 복사
      </Button>
      <p role="status">{message}</p>
    </Disclosure>
  );
}

export function ProjectEvidenceReview({ check }: { check: Check }) {
  const review = projectEvidenceReview(check);
  return (
    <Card as="section" className="project-panel evidence-review" aria-label="점검 근거와 수정 요청">
      <span className="eyebrow">확인된 근거부터 다음 행동으로</span>
      <h2>근거를 확인하고 수정 요청 만들기</h2>
      <p>
        코드 위치가 확인돼도 실제 동작이나 안전성이 검증된 것은 아닙니다. 질문별로 확인한 자료와 더
        살펴볼 내용을 구분했습니다.
      </p>
      <dl className="evidence-review-facts">
        <div>
          <dt>코드 위치 확인</dt>
          <dd>
            {review.sourceCount} / {review.items.length}개 질문
          </dd>
        </div>
        <div>
          <dt>수집한 코드</dt>
          <dd>
            {review.collectedFiles}개 파일, {review.collectedLines}줄
          </dd>
        </div>
        <div>
          <dt>코드핏의 대상 코드 실행</dt>
          <dd>실행하지 않음</dd>
        </div>
      </dl>
      <p className="project-help">
        {check.page.repository
          ? `${review.partialFiles}개 파일은 일부만 읽었습니다. ${check.page.repository.truncatedTree ? "파일 목록도 일부만 수집했습니다. " : ""}수집하지 않은 코드와 실행 경로는 미확인입니다.`
          : "공개 화면과 작성자 설명을 읽었습니다. 저장소 소스 구현은 확인하지 않았습니다."}
        {review.missingCount > 0 &&
          ` ${review.missingCount}개 질문은 코드 근거를 추가로 확인해야 합니다.`}{" "}
        아래 요청 작성과 복사에는 AI 호출을 사용하지 않습니다.
      </p>
      {review.items.map((item) => (
        <Disclosure key={item.index} className="evidence-review-item">
          <DisclosureSummary>
            <span>{item.question.area}</span>
            <span className="evidence-review-label">{item.label}</span>
          </DisclosureSummary>
          <p>{item.question.question}</p>
          {item.citation && check.page.repository ? (
            <SourceEvidence
              repository={check.page.repository}
              evidence={item.question.evidence}
              defaultOpen
            />
          ) : (
            <p className="project-help">
              {item.status === "unknown"
                ? "수집한 코드에서 이 질문의 근거를 확인하지 못했습니다. 관련 파일과 호출 경로를 먼저 확인하세요."
                : "설명이나 화면 자료만으로 구현을 확정할 수 없습니다. 실제 코드와 테스트를 대조하세요."}
            </p>
          )}
          <RepairRequest check={check} questionIndex={item.index} />
        </Disclosure>
      ))}
    </Card>
  );
}
