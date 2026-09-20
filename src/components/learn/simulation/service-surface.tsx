"use client";
import {
  Badge,
  ToggleButton,
  Button,
  Disclosure,
  DisclosureSummary,
} from "@/components/ui/primitives";
import { useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  LockKeyhole,
  ShoppingBag,
} from "lucide-react";
import { actionLabel, type Action, type Mission } from "@/lib/learn/catalog";
import { domainInfo } from "@/lib/learn/services/domains";
import { describeResult, matchesServicePolicy } from "@/lib/learn/services/rules";
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
  return (
    <div className={`sample-app service-app service-${c.domain}`}>
      <header className="service-header">
        <div>
          <small>{domain.label} / 조작 실습</small>
          <strong>{c.entity}</strong>
        </div>
        <Badge className="service-badge">가상 사례</Badge>
      </header>
      <div className="service-body">
        <div className="service-view-switch" aria-label="상세 화면 전환">
          <ToggleButton
            type="button"
            data-sim-reveal
            aria-pressed={tab === "detail"}
            onClick={() => setTab("detail")}
          >
            상세 정보
          </ToggleButton>
          <ToggleButton
            type="button"
            aria-pressed={tab === "history"}
            onClick={() => setTab("history")}
          >
            처리 이력 <span>{s.history.length}</span>
          </ToggleButton>
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
                      <small>
                        처리 순서 {i + 1} ·{" "}
                        {matchesServicePolicy(entry.result, c.samples[entry.sample].expected)
                          ? "이용 조건과 일치"
                          : "이용 조건과 불일치"}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p>아직 처리한 요청이 없습니다. 상세 정보에서 요청을 처리해 주세요.</p>
            )}
            <Button className="service-link" onClick={() => setTab("detail")}>
              상세 정보로 돌아가기 <ArrowUpRight size={14} />
            </Button>
          </div>
        ) : (
          <>
            <div className="service-section-heading">
              <h4>실험할 조건 선택</h4>
              <span>{c.samples.length}건</span>
            </div>
            <div className="service-records" role="group" aria-label="실습 데이터 선택">
              {c.samples.map((entry, i) => (
                <ToggleButton
                  type="button"
                  key={entry.label}
                  data-sim-action={sampleActions[i]}
                  data-guide-label={entry.label}
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
                      {i === 0 ? "기본 사례" : i === 1 ? "이번에 확인할 사례" : "추가 확인 사례"}
                    </small>
                  </span>
                  <span className="service-radio">{s.selected === i && <Check size={12} />}</span>
                </ToggleButton>
              ))}
            </div>
            <section className="service-detail" aria-label="선택한 요청 정보">
              <div className="service-section-heading">
                <h4>{c.entity}</h4>
                <Badge className="service-badge">검토 중</Badge>
              </div>
              <dl>
                {sample.fields.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <Disclosure className="service-policy" open>
                <DisclosureSummary>지켜야 할 이용 조건</DisclosureSummary>
                <p>{c.policy}</p>
              </Disclosure>
              {s.result && (
                <div
                  className={`service-result ${matchesServicePolicy(s.result, sample.expected) ? "accepted" : "rejected"}`}
                >
                  <b>
                    {matchesServicePolicy(s.result, sample.expected)
                      ? "이 사례는 이용 조건과 일치합니다"
                      : "이용 조건과 다른 결과입니다"}
                  </b>
                  <p>실제 동작: {s.result.detail}</p>
                  <p>기대 동작: {describeResult(c, sample.expected)}</p>
                  <small>화면의 ‘완료’ 안내가 이용 조건을 지켰다는 뜻은 아닙니다.</small>
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
              <Button
                type="button"
                className="service-submit"
                data-sim-action="case-submit"
                disabled={disabled}
                onClick={() => act("case-submit")}
              >
                {actionLabel(mission, "case-submit")}
                <ChevronRight size={16} />
              </Button>
            </section>
          </>
        )}
      </div>
      <footer className="service-footer">
        <span>각 사례는 초기 상태에서 독립적으로 실행합니다</span>
        <span>가상 서비스</span>
      </footer>
      <div className="sr-only" role="status">
        {state.trace.length ? state.message : ""}
      </div>
    </div>
  );
}
