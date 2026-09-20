# 서비스 보안 점검

`/security-check`는 모의해킹에 앞서 공개 HTTPS 문서에서 관찰 가능한 설정을 확인한다. 실제 침투 테스트나 취약점 부재의 인증을 제공하지 않는다. AI가 만들어 낸 진단 대신 결정적 규칙과 제한을 표시하며, 결과 파일에는 AI 코딩 도구로 이어갈 수정 요청을 포함한다.

## 기본 공개 설정 검사

입력한 문서를 GET으로 읽고 최종 응답의 CSP, HSTS, frame-ancestors/X-Frame-Options, nosniff, Set-Cookie의 Secure 속성을 확인한다. HTML CSP 메타 태그의 존재와 헤더의 차이를 구분한다. 적용용 헤더의 존재는 정책 강도나 브라우저 적용 성공을 뜻하지 않는다. Report-Only는 적용용 CSP로 계산하지 않는다. 쿠키 값과 이름, 원본 HTML은 결과에 포함하지 않는다.

결과는 설정 관찰, 보완 검토, 추가 확인 필요로 구분한다. 로그인, 폼 제출, 공격 페이로드, 포트 탐색, 경로 추측, 자바스크립트 실행, 서브리소스 요청은 수행하지 않는다. 접근 권한과 데이터베이스 정책은 확인 불가로 표시하고 소유한 테스트 환경의 수동 검증 과제로 연결한다. 보완 검토 수는 취약점 수가 아니다.

## 요청 제한

기존 공개 페이지 수집기의 DNS IPv4 검증, 확인한 주소에 고정 연결, 리디렉션 재검증(최대 2회), 12초 및 600KB 제한을 공유한다. HTTPS 공개 도메인만 허용하며 사용자 정보, IP 리터럴, 쿼리, 해시와 사설 주소를 거절한다. 세션별 시간당 5회, 네트워크별 15회, 대상 호스트별 10회, 전역 일일 150회로 제한한다. 오류 요청도 수집 시도 예산에 포함된다. 로그인 없이 실행 가능하나 소유 또는 허락받은 서비스라는 확인이 필요하다.

원본 응답과 보고서를 DB나 AI 제공자에 보내지 않으며 서버에는 사용량 제한용 식별자만 남긴다. 주소, 결과와 세 가지 수동 확인 메모는 현재 탭의 `sessionStorage`에 `codefit-security:<scope>` 키로 임시 보관한다. 새로고침과 관련 실습 왕복 후 복원하며, 다른 계정의 화면에 표시하지 않는다. 소유·허락 확인 체크는 복원하지 않는다.

다른 탭이나 기기와 동기화하지 않고 탭을 닫은 뒤의 복원을 보장하지 않는다. 저장소 사용이 막히면 안내하고 현재 화면에서 파일로 내려받을 수 있게 한다. ‘임시 기록 지우기’는 확인 후 해당 탭의 주소, 결과와 메모를 비운다. 전체 학습 기록 JSON 백업에는 포함하지 않는다.

## 결과 탐색과 수동 확인

상태 필터로 설정 관찰, 보완 검토, 추가 확인 필요 항목을 골라 본다. 필터를 바꿔도 내려받는 텍스트에는 전체 점검 결과와 수동 메모를 포함한다. 점검 전에도 메모를 작성하고 파일로 보관할 수 있다. 메모 작성 현황은 빈칸이 아닌 항목 수이며 검증 완료나 안전 판정이 아니다.

## 검증

관련 단위 테스트는 메타 CSP, Report-Only, HSTS max-age=0, 무효 XFO, 쿠키 비공개 처리, 내부 주소 거절, 수집 전 사용량 제한을 확인한다. 브라우저 테스트는 입력과 확인, 결과 다운로드, 오류 시 이전 결과 제거 및 모바일 폭을 확인한다. `e2e/security-records.spec.ts`는 복원과 계정 격리, `e2e/experience-ui.spec.ts`는 상태 필터, 전체 내보내기와 메모 작성 현황을 확인한다. 고정 응답을 사용하는 UI 검사이며 외부 서비스의 실제 취약점을 확인한 결과가 아니다.

참고: [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy), [MDN HSTS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security).

## 소유권 확인 후 CORS 응답 비교

로그인한 소유자가 /.well-known/codefit-security.txt 파일을 배포하면 매 검사마다 파일을 읽어 확인한 뒤, 입력한 URL에 기본, 임의 Origin, null Origin의 GET 요청을 각 1회 보낸다. 확인 파일을 포함하면 최대 4요청이다. 토큰은 1시간 유효하며 계정과 정확한 Origin에 묶인 HMAC 서명으로 검증한다. 서명에는 32자 이상 BETTER_AUTH_SECRET이 필요하고 미설정 시 실행하지 않는다.

각 연결은 공개 DNS 검사와 IP 고정을 수행한다. 리디렉션은 따라가지 않으며 쿠키, 인증 토큰과 임의 헤더를 전달하지 않는다. 각 요청은 6초, 전체 26초 제한이다. 확인 파일은 4KB까지만 읽고 검사 대상의 응답 본문은 보관하지 않는다. 반환하는 헤더는 Access-Control-Allow-Origin, Access-Control-Allow-Credentials와 Vary뿐이다. 계정과 대상은 시간당 8회, 접속망은 15회, 서비스 전체는 하루 80회로 제한한다. 파일 발급과 실패 시도도 예산에 포함한다.

임의 Origin 또는 null 반영과 credentials=true를 함께 관찰하면 우선 검토로 표시한다. 실제 인증 데이터 유출을 입증한 것은 아니다. 별표와 credentials 조합을 곧바로 취약점이라고 하지 않으며, 인증 API와 브라우저 조건은 별도 확인하도록 안내한다. 결과는 현재 화면에만 남으며 요청 조건과 응답 비교를 텍스트로 내려받는다.

## 외부 ZAP 보고서 검토

사용자가 본인의 테스트 환경에서 실행한 [OWASP ZAP](https://www.zaproxy.org/getting-started/)의 [Traditional JSON](https://www.zaproxy.org/docs/desktop/addons/report-generation/report-traditional-json/) 파일을 브라우저 안에서 읽는다. 코드핏이 ZAP을 실행하거나 해당 알림을 재검증했다고 표시하지 않는다. 입력 주소와 정확히 같은 Origin만 포함하며 규칙별 중복을 합치고 높은 위험도부터 표시한다.

최대 4MB, 20개 사이트, 사이트당 200개 알림을 지원한다. 요청·응답 원문과 공격 문자열은 결과로 옮기지 않는다. 위치에서 쿼리와 fragment를 제거하고 외부 Origin은 제외한다. 설명은 HTML을 실행하지 않고 텍스트로 출력한다. 결과는 서버나 AI로 전송하지 않고 현재 화면에만 유지한다. 수정 요청과 재현 조건, 수정 전후 결과, 오탐 사유를 쓸 기록표를 내려받을 수 있다.

새 경로의 검증은 security-audit.test.ts, security-probe.test.ts, security-audit-route.test.ts, zap-report.test.ts, e2e/workbench-upgrade.spec.ts에서 다룬다. 외부 서비스 침투 성공이나 취약점 탐지율을 측정한 테스트는 아니다. CORS 판정 범위는 [OWASP WSTG](https://wstg.owasp.org/latest/4-Web_Application_Security_Testing/11-Client-side/07-Cross_Origin_Resource_Sharing/)를 참고한다.
