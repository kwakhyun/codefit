"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/client-api";
import {
  securityExercises,
  securityReportText,
  securityStatus,
  type SecurityReport,
} from "@/lib/security-check";
export function SecurityCheck() {
  const [url, setUrl] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<SecurityReport | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  function download() {
    if (!report) return;
    const objectUrl = URL.createObjectURL(
      new Blob([securityReportText(report)], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "codefit-security-check.txt";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
  return (
    <div className="security-workspace">
      <form
        className="security-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (request.current) return;
          const controller = new AbortController();
          request.current = controller;
          setBusy(true);
          setError("");
          setReport(null);
          try {
            setReport(
              await api<SecurityReport>("/api/security-check", {
                method: "POST",
                scope: null,
                body: { url: url.trim(), authorized },
                signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
              }),
            );
          } catch (e) {
            if (!controller.signal.aborted) setError(errorMessage(e));
          } finally {
            request.current = null;
            setBusy(false);
          }
        }}
      >
        <label htmlFor="security-url">점검할 공개 서비스 링크</label>
        <input
          id="security-url"
          type="url"
          placeholder="https://my-service.com/"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setReport(null);
          }}
          required
          maxLength={2000}
          disabled={busy}
          aria-describedby="security-scope"
        />
        <p id="security-scope">
          로그인 없이 이용할 수 있습니다. 주소에 토큰과 개인정보를 넣지 마세요. 한 시간에 최대
          5회이며 요청이 많으면 더 제한될 수 있습니다.
        </p>
        <label className="security-consent">
          <input
            type="checkbox"
            checked={authorized}
            onChange={(e) => setAuthorized(e.target.checked)}
            required
            disabled={busy}
          />
          본인이 관리하거나 점검 허락을 받은 서비스입니다.
        </label>
        <button className="primary-button" disabled={!authorized || busy || !url.trim()}>
          {busy ? "공개 응답 확인 중… 최대 20초" : "공개 페이지 보안 점검"}
        </button>
        {busy && <p role="status">입력한 페이지의 응답 헤더와 HTML을 읽고 있습니다.</p>}
        {error && (
          <p role="alert" className="security-error">
            {error}
          </p>
        )}
      </form>
      {report && (
        <section className="security-results" aria-label="보안 점검 결과">
          <div className="section-heading">
            <div>
              <h2>관찰한 설정과 다음 행동</h2>
              <p>{report.url}</p>
              <p>{new Date(report.checkedAt).toLocaleString("ko-KR")} 기준</p>
            </div>
            <button className="secondary-button" onClick={download}>
              결과와 AI 수정 요청 저장
            </button>
          </div>
          <p role="status">
            설정 관찰 {report.findings.filter((f) => f.status === "observed").length}개 / 보완 검토{" "}
            {report.findings.filter((f) => f.status === "review").length}개 / 추가 확인{" "}
            {report.findings.filter((f) => f.status === "unknown").length}개
          </p>
          <p>
            설정이 있다는 사실만으로 안전하다고 판정하지 않습니다. 보완 검토는 취약점 확정이나 공격
            성공을 의미하지 않습니다.
          </p>
          <div className="security-grid">
            {report.findings.map((f) => (
              <article key={f.id} className={`security-finding security-${f.status}`}>
                <span className="eyebrow">{securityStatus[f.status]}</span>
                <h3>{f.title}</h3>
                <p>{f.evidence}</p>
                <strong>다음 행동</strong>
                <p>{f.action}</p>
              </article>
            ))}
          </div>
        </section>
      )}
      <section className="security-exercises">
        <h2>내 테스트 환경에서 이어가는 모의해킹 준비</h2>
        <p>
          공개 링크만으로 확인하지 못한 항목입니다. 운영 데이터 대신 테스트 계정과 테스트 자료로
          확인하세요.
        </p>
        {securityExercises.map((item) => (
          <details key={item.title}>
            <summary>{item.title}</summary>
            <p>{item.steps}</p>
            <p>
              <strong>기대 결과: </strong>
              {item.expected}
            </p>
            <label>
              내 확인 결과 (이 화면을 벗어나면 지워집니다)
              <textarea
                placeholder="사용한 테스트 계정, 예상 결과, 실제 결과와 남은 문제를 기록하세요. 비밀번호나 실제 사용자 정보는 제외하세요."
                maxLength={2000}
              />
            </label>
            <Link href={item.href}>관련 연습으로 확인하기 →</Link>
          </details>
        ))}
      </section>
    </div>
  );
}
