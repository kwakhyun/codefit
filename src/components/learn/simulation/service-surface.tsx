"use client";
import Image from "next/image";
import { useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  Inbox,
  LockKeyhole,
  Mail,
  Package,
  ShoppingBag,
} from "lucide-react";
import { actionLabel, type Action, type Mission } from "@/lib/learn/catalog";
import { domainInfo } from "@/lib/learn/services/domains";
import type { Simulation } from "@/lib/learn/simulation";
const sampleActions: Action[] = ["case-standard", "case-edge", "case-other"];
export function ServiceSurface({
  mission,
  state,
  act,
  disabled,
}: {
  mission: Mission;
  state: Simulation;
  act: (action: Action) => void;
  disabled: boolean;
}) {
  const [tab, setTab] = useState<"detail" | "history">("detail");
  const c = mission.service!;
  const domain = domainInfo(mission);
  const s = state.service;
  const sample = c.samples[s.selected];
  const consumer = c.domain === "commerce" || c.domain === "booking";
  return (
    <div className={`sample-app service-app service-${c.domain}`}>
      <header className="service-header">
        <div>
          <strong>
            {domain.brand}
            <span>.</span>
          </strong>
          <small>{domain.tagline}</small>
        </div>
        <span className="service-account">
          <span className="sample-avatar">지</span>
          {consumer ? "지민님" : "지민 / 운영팀"}
        </span>
      </header>
      <div className="service-location">
        <span>{consumer ? "마이페이지" : "운영 워크스페이스"}</span>
        <ChevronRight size={12} />
        <span>{c.entity}</span>
        <span className="service-reference">{consumer ? "예약·주문" : "운영"} #1048</span>
      </div>
      {c.domain === "commerce" && (
        <div className="service-product">
          <Image
            src={domain.image}
            width={1200}
            height={800}
            sizes="(max-width: 600px) 160px, 260px"
            alt="세라믹 머그와 조명, 리넨 노트가 놓인 테이블"
          />
          <div>
            <span className="service-overline">ORDINARY COLLECTION</span>
            <h3>취향을 담은 일상</h3>
            <p>세라믹, 조명과 문구를 한곳에서 만나보세요.</p>
            <span className="service-badge">
              <Package size={13} /> 국내 배송
            </span>
            <small>ORD-20260920 · 주문 정보 확인</small>
          </div>
        </div>
      )}
      {c.domain === "booking" && (
        <>
          <div className="service-space">
            <Image
              src={domain.image}
              width={1200}
              height={800}
              sizes="(max-width: 600px) 100vw, 700px"
              alt="큰 창과 원목 테이블이 있는 밝은 대관 공간"
            />
            <span>성수 / Room A</span>
          </div>
          <div className="service-space-title">
            <div>
              <span className="service-overline">성수역 도보 5분 · 단독 대관</span>
              <h3>{c.entity}</h3>
              <p>9월 20일 이용 · 예약 내용을 확인해 주세요.</p>
            </div>
            <CalendarDays size={24} />
          </div>
          {c.id === "booking-overlap" && (
            <div className="service-time-strip">
              <span>13:00</span>
              <span className="occupied">14:00</span>
              <span className="occupied">15:00</span>
              <span>16:00</span>
              <span>17:00</span>
            </div>
          )}
        </>
      )}
      {c.domain === "work" && (
        <div className="service-admin-intro">
          <div>
            <span className="service-overline">제품팀 / 가을 출시 프로젝트</span>
            <h3>{c.entity}</h3>
            <p>업무 요청을 검토하고 처리해 주세요.</p>
          </div>
          <span className="service-badge">검토 대기</span>
          <div className="service-stats">
            <div>
              <small>요청 부서</small>
              <b>브랜드팀</b>
            </div>
            <div>
              <small>담당자</small>
              <b>지민</b>
            </div>
            <div>
              <small>검토일</small>
              <b>9월 20일</b>
            </div>
          </div>
        </div>
      )}
      {c.domain === "content" && (
        <div className="service-editorial">
          <span className="service-overline">EDITION / ISSUE 042</span>
          <h3>{c.entity}</h3>
          <p>한 주의 발견을 모아, 더 나은 일상을 제안합니다.</p>
          <div>
            <span>에디터 서연</span>
            <span>9월 20일 · 읽는 시간 5분</span>
          </div>
          <blockquote>오래 머물고 싶은 공간에는 어떤 이야기가 담겨 있을까요?</blockquote>
          <span className="service-badge">
            <Mail size={13} /> 콘텐츠와 독자 관리
          </span>
        </div>
      )}
      {c.domain === "support" && (
        <div className="service-inbox">
          <div className="service-inbox-heading">
            <Inbox size={20} />
            <h3>{c.entity}</h3>
            <span className="service-badge">처리 대기</span>
          </div>
          <div className="service-customer">
            <span className="sample-avatar">서</span>
            <div>
              <b>서연 고객님</b>
              <small>웹사이트 문의 · 오늘 10:24</small>
            </div>
            <span>담당 지민</span>
          </div>
          <p className="service-bubble">
            {c.id === "support-refund"
              ? "일부 상품을 반품했어요. 남은 상품도 환불받을 수 있을까요?"
              : c.id === "support-attachment"
                ? "받은 상품의 상태를 사진으로 첨부하려고 해요."
                : c.id === "support-export"
                  ? "지난 상담 내용을 확인하고 싶어요."
                  : "주문한 상품의 배송 일정을 알려 주세요."}
          </p>
          <p className="service-internal-note">
            <LockKeyhole size={13} /> 내부 메모: 고객 요청과 처리 조건을 확인해 주세요.
          </p>
        </div>
      )}
      <div className="service-body">
        <div className="service-view-switch" aria-label="상세 화면 전환">
          <button type="button" aria-pressed={tab === "detail"} onClick={() => setTab("detail")}>
            상세 정보
          </button>
          <button type="button" aria-pressed={tab === "history"} onClick={() => setTab("history")}>
            처리 이력 <span>{s.history.length}</span>
          </button>
        </div>
        {tab === "history" ? (
          <div className="service-history">
            <h4>처리 이력</h4>
            {s.history.length ? (
              <ol>
                {s.history.map((entry, i) => (
                  <li key={i}>
                    <span className="service-history-icon">
                      {entry.result.allowed ? <Check size={14} /> : <LockKeyhole size={14} />}
                    </span>
                    <div>
                      <b>{c.samples[entry.sample].label}</b>
                      <p>{entry.result.detail}</p>
                      <small>처리 순서 {i + 1}</small>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p>아직 처리한 요청이 없습니다. 상세 정보에서 요청을 처리해 주세요.</p>
            )}
            <button className="service-link" onClick={() => setTab("detail")}>
              상세 정보로 돌아가기 <ArrowUpRight size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className="service-section-heading">
              <h4>{consumer ? "이용 정보 선택" : "검토할 요청"}</h4>
              <span>{c.samples.length}건</span>
            </div>
            <div className="service-records" role="group" aria-label="실습 데이터 선택">
              {c.samples.map((entry, i) => (
                <button
                  type="button"
                  key={entry.label}
                  disabled={disabled}
                  aria-label={entry.label}
                  aria-pressed={s.selected === i}
                  onClick={() => act(sampleActions[i])}
                >
                  <span className="service-record-icon">
                    {c.domain === "commerce" ? (
                      <ShoppingBag size={17} />
                    ) : c.domain === "booking" ? (
                      <CalendarDays size={17} />
                    ) : (
                      <FileText size={17} />
                    )}
                  </span>
                  <span>
                    <b>{entry.label}</b>
                    <small>
                      {consumer ? "이용 조건" : "요청"} {String(i + 1).padStart(2, "0")} ·{" "}
                      {entry.fields[0][0]}
                    </small>
                  </span>
                  <span className="service-radio">{s.selected === i && <Check size={12} />}</span>
                </button>
              ))}
            </div>
            <section className="service-detail" aria-label="선택한 요청 정보">
              <div className="service-section-heading">
                <h4>{c.entity}</h4>
                <span className="service-badge">검토 중</span>
              </div>
              <dl>
                {sample.fields.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
                {c.domain === "commerce" && (
                  <div>
                    <dt>받는 분</dt>
                    <dd>김지민 / 서울 성동구</dd>
                  </div>
                )}
                {c.domain === "support" && (
                  <div>
                    <dt>고객 번호</dt>
                    <dd>CUS-1048</dd>
                  </div>
                )}
              </dl>
              <details className="service-policy" open>
                <summary>{consumer ? "이용 조건 안내" : "처리 기준"}</summary>
                <p>{c.policy}</p>
              </details>
              {s.result && (
                <div className={`service-result ${s.result.allowed ? "accepted" : "rejected"}`}>
                  <b>{s.result.allowed ? "처리 결과" : "요청 확인 필요"}</b>
                  <p>{s.result.detail}</p>
                  {c.id === "support-close" && s.result.allowed && (
                    <span>문의 상태: 해결 완료</span>
                  )}
                  {c.id === "content-expiry" && s.result.allowed && (
                    <p>
                      도시의 오래된 골목에서 새로운 이야기를 발견합니다. 오늘은 창작자의 작업 공간을
                      찾아가 봅니다.
                    </p>
                  )}
                </div>
              )}
              <button
                type="button"
                className="service-submit"
                disabled={disabled}
                onClick={() => act("case-submit")}
              >
                {actionLabel(mission, "case-submit")}
                <ChevronRight size={16} />
              </button>
            </section>
          </>
        )}
      </div>
      <footer className="service-footer">
        <span>{domain.brand} / 고객 경험을 연결합니다</span>
        <span>가상 서비스</span>
      </footer>
      <div className="sample-feedback" role="status">
        {state.trace.length ? state.message : ""}
      </div>
    </div>
  );
}
