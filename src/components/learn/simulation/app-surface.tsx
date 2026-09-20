import {
  Button,
  Disclosure,
  DisclosureSummary,
  ToggleButton,
  Card,
} from "@/components/ui/primitives";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  CalendarDays,
  Check,
  FileText,
  LockKeyhole,
  PawPrint,
  Search,
  ShoppingBag,
} from "lucide-react";
import { ACTION_LABELS, type Action, type Mission } from "@/lib/learn/catalog";
import type { Simulation } from "@/lib/learn/simulation";

type Props = {
  mission: Mission;
  state: Simulation;
  act: (action: Action) => void;
  disabled: boolean;
};
const identities = {
  memo: ["folio", "나의 기록"],
  request: ["folio", "나의 기록"],
  access: ["teamspace", "팀 문서"],
  filter: ["worklog", "프로젝트 관리"],
  price: ["paper room", "매일 쓰고 싶은 문구"],
  search: ["petmate", "나와 맞는 반려동물 찾기"],
  booking: ["studio day", "나만의 촬영 공간"],
};
function AppAction({
  action,
  act,
  children,
  primary = false,
}: {
  action: Action;
  act: Props["act"];
  children?: ReactNode;
  primary?: boolean;
}) {
  return (
    <Button
      type="button"
      className={primary ? "sample-primary" : "sample-button"}
      data-sim-action={action}
      aria-label={ACTION_LABELS[action]}
      onClick={() => act(action)}
    >
      {children || ACTION_LABELS[action]}
    </Button>
  );
}
export function AppSurface({ mission, state: s, act, disabled }: Props) {
  if (mission.app === "service") return null;
  const [brand, tagline] = identities[mission.app];
  return (
    <div className="sample-app">
      <header className="sample-header">
        <div>
          <strong>
            {brand}
            <span className="sample-brand-dot">.</span>
          </strong>
          <small>{tagline}</small>
        </div>
        <span className="sample-avatar" role="img" aria-label={`사용자 ${s.actor}`}>
          {s.actor.slice(0, 1)}
        </span>
      </header>
      <div className="service-location">
        <span>
          {mission.app === "price"
            ? "온라인 스토어"
            : mission.app === "booking"
              ? "공간 예약"
              : "내 워크스페이스"}
        </span>
        <span>/</span>
        <span>{tagline}</span>
        <span className="service-reference">9월 20일</span>
      </div>
      <fieldset className="sample-controls" disabled={disabled}>
        <legend className="sr-only">{tagline} 서비스 조작</legend>
        <div className="sample-content">
          {(mission.app === "memo" || mission.app === "request") && (
            <>
              <div className="sample-breadcrumb">
                개인 공간 <span>/</span> 내 문서
              </div>
              <div className="sample-heading">
                <div>
                  <span className="sample-kicker">MY WORKSPACE</span>
                  <h3>출시 준비 노트</h3>
                </div>
                <FileText size={26} />
              </div>
              <div className="sample-document-meta">
                <span>지민이 작성</span>
                <span>나만 보기</span>
              </div>
              <article className="sample-document">
                <span className="sample-tag">출시 계획</span>
                <h4>서비스 출시 준비</h4>
                <div className="service-stats">
                  <div>
                    <small>담당자</small>
                    <b>지민</b>
                  </div>
                  <div>
                    <small>일정</small>
                    <b>9월 27일</b>
                  </div>
                  <div>
                    <small>상태</small>
                    <b>검토 중</b>
                  </div>
                </div>
                <hr />
                <p className={!s.memo ? "sample-empty" : ""}>
                  {s.memo || "문서 내용이 비어 있습니다."}
                </p>
                {s.memo && (
                  <p className="sample-document-hint">
                    주문부터 고객 안내까지 전체 흐름을 점검합니다. 저장 결과는 새로고침과 다른
                    기기에서도 확인해 주세요.
                  </p>
                )}
              </article>
              <div className="sample-footer">
                <span>문서 01 / 개인 기록</span>
                <AppAction action="save" act={act} primary>
                  저장하기
                </AppAction>
              </div>
            </>
          )}
          {mission.app === "access" && (
            <>
              <div className="sample-breadcrumb">
                워크스페이스 <span>/</span> 제품팀
              </div>
              <div className="sample-heading">
                <div>
                  <span className="sample-kicker">TEAM DOCUMENTS</span>
                  <h3>팀의 아이디어를 한곳에</h3>
                </div>
                <LockKeyhole size={24} />
              </div>
              <div className="sample-identity">
                <span>
                  현재 사용자 <b>{s.actor}</b>
                </span>
                <AppAction action="switch-user" act={act}>
                  다른 사용자로 전환
                </AppAction>
              </div>
              <article className="sample-document">
                <span className="sample-tag">
                  <LockKeyhole size={12} /> 비공개 문서
                </span>
                <h4>출시 전 아이디어</h4>
                <p>문서 소유자 지민 · 제품 기획</p>
                <div className="service-stats">
                  <div>
                    <small>프로젝트</small>
                    <b>가을 업데이트</b>
                  </div>
                  <div>
                    <small>접근 범위</small>
                    <b>작성자만</b>
                  </div>
                </div>
                <AppAction action="open-private" act={act} primary>
                  문서 열기
                </AppAction>
                {s.trace.some((t) => t.startsWith(ACTION_LABELS["open-private"])) && (
                  <div className="sample-open-document">
                    {s.message.includes("거절") ? (
                      <p>이 문서를 볼 권한이 없습니다.</p>
                    ) : s.message.includes("아이디어") ? (
                      <>
                        <h4>신규 기능 기획</h4>
                        <p>첫 방문 고객을 위한 맞춤 안내를 다음 출시 때 추가합니다.</p>
                        <span>검토 담당자: 지민</span>
                      </>
                    ) : (
                      <p>문서를 다시 열어 접근 권한을 확인하세요.</p>
                    )}
                  </div>
                )}
              </article>
            </>
          )}
          {mission.app === "price" && (
            <>
              <div className="sample-breadcrumb">
                홈 <span>/</span> 노트 & 기록
              </div>
              <div className="sample-shop-product">
                <Image
                  className="sample-product-photo"
                  src="/images/services/lifestyle.webp"
                  width={1200}
                  height={800}
                  sizes="(max-width: 600px) 160px, 260px"
                  alt="머그와 리넨 노트가 놓인 테이블"
                />
                <div>
                  <span className="sample-kicker">PAPER ROOM ORIGINAL</span>
                  <h3>데일리 라인 노트</h3>
                  <p>가볍게 쓰고, 오래 간직하세요.</p>
                  <strong className="sample-price">10,000원</strong>
                  <small>오프화이트 · A5 · 80매</small>
                </div>
              </div>
              <div className="sample-promotion">
                <ShoppingBag size={16} /> 노트 3개부터 10% 할인
              </div>
              <div className="sample-order-row">
                <span>수량</span>
                <div className="sample-quantity">
                  <strong>{s.quantity}개</strong>
                  <AppAction action="quantity" act={act}>
                    3개 담기
                  </AppAction>
                  <AppAction action="invalid-quantity" act={act}>
                    −1개 입력
                  </AppAction>
                </div>
              </div>
              <div className="sample-order-total">
                <span>주문 금액</span>
                <strong>
                  {s.amount === null
                    ? "수량을 확인해 주세요"
                    : `${s.amount.toLocaleString("ko-KR")}원`}
                </strong>
              </div>
              <div className="service-delivery">
                <b>배송 안내</b>
                <p>
                  서울 성동구 · 김지민님
                  <br />
                  무료배송 / 영업일 기준 2–3일 소요
                </p>
                <Disclosure>
                  <DisclosureSummary>교환 및 반품 안내</DisclosureSummary>
                  <p>
                    상품 수령 후 7일 이내 고객센터로 접수해 주세요. 사용한 상품은 반품이 제한될 수
                    있습니다.
                  </p>
                </Disclosure>
              </div>
            </>
          )}
          {mission.app === "filter" && (
            <>
              <div className="sample-breadcrumb">
                제품팀 <span>/</span> 서비스 출시
              </div>
              <div className="sample-heading">
                <div>
                  <span className="sample-kicker">PROJECT BOARD</span>
                  <h3>이번 주 할 일</h3>
                </div>
                <span className="sample-tag">진행 중</span>
              </div>
              <p className="sample-subtitle">출시 전에 팀에서 함께 확인할 작업입니다.</p>
              <div className="sample-tabs">
                <ToggleButton
                  type="button"
                  aria-pressed={!s.filtered}
                  onClick={() => act("refresh")}
                  data-sim-action="refresh"
                  aria-label="전체 다시 보기"
                >
                  전체
                </ToggleButton>
                <ToggleButton
                  type="button"
                  aria-pressed={s.filtered}
                  onClick={() => act("filter")}
                  data-sim-action="filter"
                  aria-label={ACTION_LABELS.filter}
                >
                  완료
                </ToggleButton>
              </div>
              <ul className="sample-task-list">
                {(s.filtered ? s.todos.filter((t) => t.done) : s.todos).map((t) => (
                  <li key={t.title}>
                    <span
                      className={`sample-check ${t.done ? "checked" : ""}`}
                      role="img"
                      aria-label={t.done ? "완료" : "미완료"}
                    >
                      {t.done && <Check size={14} />}
                    </span>
                    <div>
                      <strong>{t.title}</strong>
                      <small>PRJ-2409 · 제품팀 · 담당 지민 · 마감 9/27</small>
                    </div>
                    <span className="sample-tag">{t.done ? "완료" : "예정"}</span>
                  </li>
                ))}
              </ul>
              <p className="sample-list-count">
                {(s.filtered ? s.todos.filter((t) => t.done) : s.todos).length}개 작업
              </p>
            </>
          )}
          {mission.app === "search" && (
            <>
              <div className="sample-search-hero">
                <PawPrint size={28} />
                <h3>어떤 친구를 찾고 있나요?</h3>
                <p>반려동물의 성격과 생활 환경을 확인하고 만남을 준비하세요.</p>
              </div>
              <div className="sample-search-box">
                <Search size={18} />
                <span>{s.query || "고양이 또는 강아지를 검색하세요"}</span>
              </div>
              <div className="sample-search-chips">
                <AppAction action="search-old" act={act}>
                  고양이 검색
                </AppAction>
                <AppAction action="search-new" act={act}>
                  강아지 검색
                </AppAction>
              </div>
              <div className="sample-search-results" aria-live="polite">
                {s.result ? (
                  <>
                    <span className="sample-kicker">검색 결과 · {s.result}</span>
                    <Card as="div" className="sample-pet-card">
                      <div className={`sample-pet-art ${s.result === "고양이" ? "cat" : "dog"}`}>
                        <PawPrint size={44} />
                      </div>
                      <div>
                        <h4>
                          {s.result === "고양이" ? "호기심 많은 나비" : "산책을 좋아하는 두부"}
                        </h4>
                        <p>
                          {s.result} · 2살 · 서울 성동구
                          <br />
                          건강 검진 완료 · 예방 접종 완료
                        </p>
                        <span className="sample-tag">새 가족을 기다려요</span>
                      </div>
                    </Card>
                  </>
                ) : (
                  <div className="sample-empty">
                    <PawPrint size={32} />
                    <p>
                      {s.pending.length
                        ? "친구들을 찾고 있어요…"
                        : "검색하면 친구들의 프로필이 나타나요."}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
          {mission.app === "booking" && (
            <>
              <Image
                className="sample-studio-photo"
                src="/images/services/studio.webp"
                width={1200}
                height={800}
                sizes="(max-width: 600px) 100vw, 640px"
                alt="자연광이 들어오는 원목 테이블과 대관 공간"
              />
              <div className="sample-heading">
                <div>
                  <span className="sample-kicker">서울 성수 · 자연광 스튜디오</span>
                  <h3>오후의 빛이 머무는 공간</h3>
                </div>
              </div>
              <p className="sample-subtitle">최대 4인 · 촬영 장비 포함 · 시간당 30,000원</p>
              <div className="sample-reservation">
                <CalendarDays size={20} />
                <div>
                  <strong>10월 12일 · 14:00–15:00</strong>
                  <small>예약 A / Room A</small>
                </div>
                <AppAction action="book" act={act} primary>
                  예약하기
                </AppAction>
              </div>
              <div className="sample-booking-options">
                <AppAction action="repeat-book" act={act}>
                  같은 예약 재전송
                </AppAction>
                <AppAction action="new-booking" act={act}>
                  15:00 시간 새로 예약
                </AppAction>
              </div>
              <h4>
                내 예약 <span className="sample-tag">{s.bookings.length}건</span>
              </h4>
              <ul className="sample-reservation-list">
                {s.bookings.map((id, i) => (
                  <li key={`${id}-${i}`}>
                    <Check size={16} />
                    <div>
                      <strong>{id} · 접수 완료</strong>
                      <small>10월 12일 · {id === "예약 A" ? "14:00" : "15:00"} · Room A</small>
                    </div>
                  </li>
                ))}
              </ul>
              {!s.bookings.length && <p className="sample-empty">아직 예약한 공간이 없어요.</p>}
            </>
          )}
        </div>
      </fieldset>
      <div className="service-footer">
        <span>
          {brand} / {tagline}
        </span>
        <span>가상 서비스</span>
      </div>
      <div className="sample-feedback" role="status">
        {s.trace.length ? s.message : ""}
      </div>
    </div>
  );
}
