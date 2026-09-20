"use client";
import { Card, Status, Anchor, Button, ToggleButton, FieldLabel } from "@/components/ui/primitives";
import { SectionArtwork } from "@/components/experience/section-artwork";
import { learningStorageDescription } from "@/lib/learn/session";
import { Select } from "@/components/ui/select";
import { GuestLogin } from "@/components/account/guest-login";
import { useState } from "react";
import { ServiceDomainIcon } from "./service-domain-icon";
import { ServiceThumbnail } from "./service-thumbnail";
import { MISSIONS } from "@/lib/learn/catalog";
import { SERVICE_DOMAINS, domainFor } from "@/lib/learn/services/domains";
import { AppLink as Link } from "@/components/ui/primitives";
import { useLearningOverview } from "@/hooks/use-learning-overview";
import { learningOverview, hasLearningDraft, LEARNING_STAGES } from "@/lib/learn/overview";
export function LearningDashboard() {
  const [domain, setDomain] = useState("all");
  const [concept, setConcept] = useState("all");
  const concepts = [...new Set(MISSIONS.map((m) => m.concept))];
  const { data, error, reload } = useLearningOverview();
  const { missions, next, resume, complete } = learningOverview(data?.progress || []);
  return (
    <>
      <Card as="section" className="resume-card illustrated-resume" aria-label="추천 입문 미션">
        <SectionArtwork topic="principles" />
        <div>
          <span className="eyebrow">
            {resume
              ? "이어서 연습할 미션"
              : complete === MISSIONS.length
                ? "모든 미션을 마쳤어요"
                : "여기서 시작해 보세요"}
          </span>
          <h2>{next.mission.title}</h2>
          <p>
            {resume
              ? `${next.record.stage + 1}/4단계 · ${LEARNING_STAGES[next.record.stage]}부터 이어갑니다.`
              : `약 ${next.mission.minutes}분 · ${next.mission.summary}`}
          </p>
        </div>
        {data ? (
          <Link className="primary-button" href={`/learn/${next.mission.id}`}>
            {resume
              ? "이어서 연습하기"
              : complete === MISSIONS.length
                ? "첫 미션 다시 살펴보기"
                : complete
                  ? "다음 미션 시작하기"
                  : "첫 미션 시작하기 (약 5분)"}{" "}
            →
          </Link>
        ) : (
          <Status role="status">
            {error ? "아래 미션은 바로 시작할 수 있습니다." : "학습 기록 불러오는 중…"}
          </Status>
        )}
      </Card>
      <nav className="course-shortcuts" aria-label="입문 과정 바로가기">
        <Anchor
          href="#basics"
          onClick={() => {
            setDomain("all");
            setConcept("all");
          }}
        >
          서비스 원리 {MISSIONS.filter((m) => m.kind === "foundation").length}개
        </Anchor>
        <Anchor
          href="#labs"
          onClick={() => {
            setDomain("all");
            setConcept("all");
          }}
        >
          서비스 오류 해결 {MISSIONS.filter((m) => m.kind === "lab").length}개
        </Anchor>
      </nav>
      <div className="learn-progress">
        <strong>
          {data
            ? `${complete} / ${MISSIONS.length}개 미션 완료`
            : error
              ? "학습 기록 확인 필요"
              : "학습 기록을 불러오는 중…"}
        </strong>
        <span>{learningStorageDescription(Boolean(data?.signedIn))}</span>
      </div>
      {data && !data.signedIn && <GuestLogin returnTo="/learn" />}
      {error && (
        <Status role="alert">
          기록을 불러오지 못했습니다. {error}{" "}
          <Button className="text-button" onClick={reload}>
            다시 불러오기
          </Button>
        </Status>
      )}
      <section aria-label="실습 찾기" className="learn-catalog-filters">
        <h2>관심 있는 서비스부터 살펴보세요</h2>
        <div className="domain-filters" role="group" aria-label="서비스 분야">
          <ToggleButton
            data-service-domain="all"
            aria-pressed={domain === "all"}
            onClick={() => {
              setDomain("all");
              setConcept("all");
            }}
          >
            <ServiceDomainIcon domain="all" />
            <span className="domain-name">전체</span>
            <span className="domain-count">{MISSIONS.length}</span>
          </ToggleButton>
          {SERVICE_DOMAINS.map((d) => (
            <ToggleButton
              key={d.id}
              data-service-domain={d.id}
              aria-pressed={domain === d.id}
              onClick={() => {
                setDomain(d.id);
                setConcept("all");
              }}
            >
              <ServiceDomainIcon domain={d.id} />
              <span className="domain-name">{d.label}</span>
              <span className="domain-count">
                {MISSIONS.filter((m) => domainFor(m) === d.id).length}
              </span>
            </ToggleButton>
          ))}
        </div>
        <div className="learn-filter-row">
          <FieldLabel>
            기술 개념
            <Select
              label="기술 개념"
              value={concept}
              onValueChange={setConcept}
              options={[
                { value: "all", label: "모든 개념" },
                ...concepts
                  .filter((c) =>
                    MISSIONS.some(
                      (m) => m.concept === c && (domain === "all" || domainFor(m) === domain),
                    ),
                  )
                  .map((value) => ({ value, label: value })),
              ]}
            />
          </FieldLabel>
          <Status role="status">
            {
              missions.filter(
                ({ mission: m }) =>
                  (domain === "all" || domainFor(m) === domain) &&
                  (concept === "all" || m.concept === concept),
              ).length
            }
            개 실습
          </Status>
        </div>
      </section>
      {(["foundation", "lab"] as const).map((kind) => (
        <section
          id={kind === "lab" ? "labs" : "basics"}
          className="learn-course"
          key={kind}
          hidden={
            !missions.some(
              ({ mission: m }) =>
                m.kind === kind &&
                (domain === "all" || domainFor(m) === domain) &&
                (concept === "all" || m.concept === concept),
            )
          }
        >
          <div className="learn-section-title">
            <span className="eyebrow">
              {kind === "foundation" ? "01 / 직접 해보며 배우기" : "02 / 배운 것을 써보기"}
            </span>
            <h2>{kind === "foundation" ? "서비스 원리 배우기" : "서비스 오류 해결 실습"}</h2>
            <p>
              {kind === "foundation"
                ? "데이터 저장부터 주문, 예약, 고객 상담까지 직접 확인하며 배웁니다."
                : "예제 서비스의 오류를 찾아 AI에게 보낼 수정 요청을 작성하고, 수정 결과를 확인합니다."}
            </p>
          </div>
          <div className="learn-cards">
            {missions
              .filter(
                ({ mission: m }) =>
                  m.kind === kind &&
                  (domain === "all" || domainFor(m) === domain) &&
                  (concept === "all" || m.concept === concept),
              )
              .map(({ mission: m, record: r, completed }) => {
                return (
                  <Link
                    href={`/learn/${m.id}`}
                    className="learn-card"
                    data-service-domain={domainFor(m)}
                    key={m.id}
                  >
                    <span className="scenario-thumbnail">
                      <ServiceThumbnail mission={m} />
                    </span>
                    <div>
                      <span>
                        {domainInfoLabel(m)} / {m.concept}
                      </span>
                      <span>{m.minutes}분</span>
                    </div>
                    <h3>{m.title}</h3>
                    <p>{m.summary}</p>
                    <strong>
                      {completed
                        ? "완료 · 다시 살펴보기"
                        : hasLearningDraft(r)
                          ? "이어서 연습하기"
                          : "미션 시작하기"}{" "}
                      →
                    </strong>
                  </Link>
                );
              })}
          </div>
        </section>
      ))}
    </>
  );
}

function domainInfoLabel(m: (typeof MISSIONS)[number]) {
  return SERVICE_DOMAINS.find((d) => d.id === domainFor(m))!.label;
}
