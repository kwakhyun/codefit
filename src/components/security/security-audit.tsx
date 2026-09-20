"use client";
import {
  Disclosure,
  DisclosureSummary,
  FieldLabel,
  Input,
  Button,
  Status,
  Anchor,
} from "@/components/ui/primitives";
import { useEffect, useRef, useState } from "react";
import { AppLink as Link } from "@/components/ui/primitives";
import { api, ApiError, errorMessage } from "@/lib/client-api";
import { corsAuditText, type CorsAudit, type OwnershipChallenge } from "@/lib/security-audit";
import { parseZapReport, zapReviewText, type ZapFinding } from "@/lib/zap-report";
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function SecurityAudit({ scope, url }: { scope: string; url: string }) {
  const [challenge, setChallenge] = useState<OwnershipChallenge | null>(null);
  const [result, setResult] = useState<CorsAudit | null>(null);
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [findings, setFindings] = useState<ZapFinding[] | null>(null);
  const [importError, setImportError] = useState("");
  const request = useRef<AbortController | null>(null);
  const uploadRevision = useRef(0);
  useEffect(
    () => () => {
      request.current?.abort();
      uploadRevision.current++;
    },
    [],
  );
  async function run() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setNeedsLogin(false);
    setResult(null);
    try {
      const response = await api<OwnershipChallenge | CorsAudit>("/api/security-check/audit", {
        method: "POST",
        scope,
        body: {
          url: url.trim(),
          authorized: approved,
          ...(challenge ? { token: challenge.token } : {}),
        },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]),
      });
      if (!controller.signal.aborted) {
        if ("token" in response) setChallenge(response);
        else setResult(response);
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(errorMessage(e));
        setNeedsLogin(e instanceof ApiError && e.status === 401);
      }
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="security-audit" aria-label="심화 보안 점검">
      <h2>한 단계 더 확인하기</h2>
      <p>읽기 전용 응답 비교 또는 직접 실행한 ZAP 보고서로 재현 근거를 정리합니다.</p>
      <Disclosure className="audit-method">
        <DisclosureSummary>
          <strong>소유권 확인 후 CORS 테스트</strong>
          <span>로그인 필요 · GET 요청 3회 · 최대 30초</span>
        </DisclosureSummary>
        <p>
          임의의 외부 Origin과 null Origin을 보냈을 때, 서버가 어떤 접근 허용 헤더를 반환하는지
          비교합니다. 로그인 쿠키나 인증 토큰은 전송하지 않습니다.
        </p>
        <p>
          위 입력란의 주소를 사용합니다: <strong>{url || "먼저 서비스 링크를 입력하세요"}</strong>
        </p>
        <FieldLabel className="security-consent">
          <Input
            type="checkbox"
            checked={approved}
            onChange={(e) => setApproved(e.target.checked)}
            disabled={busy}
          />
          본인이 관리하는 읽기 전용 페이지이며, 기본 요청과 검사 Origin 요청을 보내는 데 동의합니다.
        </FieldLabel>
        {!challenge && (
          <Button
            className="secondary-button"
            disabled={!approved || !url.trim() || busy}
            onClick={() => void run()}
          >
            {busy ? "발급 중…" : "소유권 확인 파일 발급"}
          </Button>
        )}
        {challenge && (
          <div className="ownership-instructions">
            <h3>1. 파일을 배포하세요</h3>
            <p>
              아래 파일을 다운로드하고 안내한 주소에서 텍스트로 열리도록 배포하세요. Next.js는
              public/.well-known/codefit-security.txt에 둘 수 있습니다.
            </p>
            <code>{challenge.fileUrl}</code>
            <Button
              className="secondary-button"
              onClick={() => download("codefit-security.txt", challenge.token)}
              disabled={busy}
            >
              확인 파일 다운로드
            </Button>
            <p>
              유효 시간: {new Date(challenge.expiresAt).toLocaleString("ko-KR")}. 검사할 때마다
              파일을 다시 확인합니다.
            </p>
            <h3>2. 배포 후 테스트를 실행하세요</h3>
            <Button
              className="primary-button"
              disabled={!approved || busy}
              onClick={() => void run()}
            >
              {busy ? "소유권 확인 및 응답 비교 중…" : "소유권 확인하고 CORS 테스트"}
            </Button>
            <Button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setChallenge(null);
                setResult(null);
              }}
            >
              확인 파일 다시 발급하기
            </Button>
          </div>
        )}
        {busy && (
          <Status role="status">
            확인 파일 외에는 입력한 주소 한 곳에만 요청합니다. 리디렉션은 따라가지 않습니다.
          </Status>
        )}
        {error && (
          <div role="alert">
            <p className="security-error">{error}</p>
            {needsLogin && <Link href="/login?returnTo=%2Fsecurity-check">로그인 화면 열기</Link>}
          </div>
        )}
        {result && (
          <section className="cors-result" aria-label="CORS 테스트 결과">
            <h3>
              {result.status === "review"
                ? "우선 검토할 응답을 발견했습니다"
                : result.status === "unknown"
                  ? "판단할 응답이 부족합니다"
                  : "응답 비교를 마쳤습니다"}
            </h3>
            <p>{result.summary}</p>
            <div className="audit-table-wrap">
              <table>
                <caption>
                  실제 응답 비교 · {new Date(result.checkedAt).toLocaleString("ko-KR")}
                </caption>
                <thead>
                  <tr>
                    <th>요청</th>
                    <th>HTTP</th>
                    <th>Allow-Origin</th>
                    <th>Credentials</th>
                  </tr>
                </thead>
                <tbody>
                  {result.evidence.map((e) => (
                    <tr key={e.label}>
                      <th scope="row">
                        {e.label}
                        <small>{e.origin || "Origin 없음"}</small>
                      </th>
                      <td>{e.status}</td>
                      <td>{e.allowOrigin || "없음"}</td>
                      <td>{e.allowCredentials || "없음"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>{result.nextStep}</p>
            <Button
              className="secondary-button"
              onClick={() => download("codefit-cors-test.txt", corsAuditText(result))}
            >
              요청과 응답 비교 저장
            </Button>
            <p className="project-help">
              데이터 유출을 재현한 결과가 아닙니다. 인증 후 응답, 브라우저 정책과 경로별 권한은 별도
              확인해야 합니다.
            </p>
          </section>
        )}
      </Disclosure>
      <Disclosure className="audit-method">
        <DisclosureSummary>
          <strong>OWASP ZAP 보고서 가져오기</strong>
          <span>실제 스캐너 결과 → 수정 우선순위 → 재검사 기록</span>
        </DisclosureSummary>
        <ol className="audit-steps">
          <li>
            본인의 테스트 환경을 ZAP에서 검사합니다. 로그인 흐름과 검사 범위는{" "}
            <Anchor
              href="https://www.zaproxy.org/getting-started/"
              target="_blank"
              rel="noreferrer"
            >
              ZAP 안내
            </Anchor>
            를 참고하세요.
          </li>
          <li>보고서를 Traditional JSON 형식으로 내보냅니다.</li>
          <li>
            위 서비스 주소와 같은 Origin의 알림만 가져옵니다. 이 기능은 파일을 브라우저 안에서
            읽으며 서버나 AI로 보내지 않습니다.
          </li>
        </ol>
        <FieldLabel htmlFor="zap-report">ZAP Traditional JSON 파일 (최대 4MB)</FieldLabel>
        <Input
          id="zap-report"
          type="file"
          accept=".json,application/json"
          disabled={!url.trim()}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            const revision = ++uploadRevision.current;
            setFindings(null);
            setImportError("");
            if (!file) return;
            try {
              if (file.size > 4_000_000) throw new Error("보고서는 4MB 이하로 내보내 주세요.");
              const parsed = parseZapReport(await file.text(), url);
              if (revision === uploadRevision.current) setFindings(parsed);
            } catch (e) {
              if (revision === uploadRevision.current) setImportError(errorMessage(e));
            }
          }}
        />
        <p>
          요청·응답 원문, 공격 문자열과 URL 쿼리는 가져오지 않습니다. 남은 설명과 경로도 공유 전에
          확인하세요. 페이지를 떠나면 가져온 결과는 사라집니다.
        </p>
        {importError && (
          <Status role="alert" className="security-error">
            {importError}
          </Status>
        )}
        {findings && (
          <div aria-label="ZAP 알림 목록">
            <Status role="status">
              규칙별 알림 {findings.length}개 · 외부 보고서의 결과이며 코드핏 재검증은 하지
              않았습니다.
            </Status>
            <Button
              className="secondary-button"
              onClick={() => download("codefit-zap-review.txt", zapReviewText(url, findings))}
            >
              수정 요청과 재검사 기록표 저장
            </Button>
            {findings.map((f) => (
              <Disclosure className="zap-finding" key={f.id}>
                <DisclosureSummary>
                  {["정보", "낮음", "중간", "높음"][f.risk]} · {f.title}
                </DisclosureSummary>
                <p>{f.description}</p>
                <strong>수정 방향</strong>
                <p>{f.solution || "원본 보고서에서 확인하세요."}</p>
                <ul>
                  {f.locations.map((location) => (
                    <li key={location}>
                      <code>{location}</code>
                    </li>
                  ))}
                </ul>
                <Anchor
                  href={`https://www.zaproxy.org/docs/alerts/${f.id}/`}
                  target="_blank"
                  rel="noreferrer"
                >
                  ZAP 규칙 {f.id} 확인
                </Anchor>
              </Disclosure>
            ))}
          </div>
        )}
      </Disclosure>
    </section>
  );
}
