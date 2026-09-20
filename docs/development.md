# CODE:FIT 개발과 운영

서비스 소개는 [README](../README.md), 설계 근거는 [engineering.md](engineering.md)를 참고하세요.

## 로컬 실행

Node.js 22.x(22.13 이상)가 필요합니다. Docker 없이 SQLite로 실행할 수 있습니다.

```bash
npm ci
test -f .env.local || cp .env.example .env.local
npm run dev
```

기존 `.env.local`이 있으면 덮어쓰지 마세요. 기본 주소는 `http://localhost:3000`입니다. OAuth를 사용하면 [인증 환경 변수](authentication.md#서버-환경-변수)의 `AUTH_BASE_URL`, `BETTER_AUTH_SECRET`과 제공자 키를 설정하고 콜백도 같은 주소로 맞춥니다. API 키 없이도 입문 미션, 내장 문제, 코드 작성/저장, 코드 이해 훈련의 예측과 실행 테스트, 힌트, 정답, 백업을 사용할 수 있습니다.

| 환경 변수                     | 용도                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`              | 서버 전용 AI 키. 문제 생성, 풀이 검토, 학습 가이드와 프로젝트 점검에 사용                          |
| `OPENAI_GENERATION_MODEL`     | 문제 생성 기본 `gpt-5.6-sol` (GPT-5.6 Sol)                                                         |
| `OPENAI_REVIEW_MODEL`         | 풀이 검토와 맞춤 질문 기본 `gpt-5.6-luna`, `medium` 추론. 이전 `OPENAI_MODEL`은 검토에만 호환 적용 |
| `OPENAI_COACH_MODEL`          | 선택적 코드 이해 코칭 전용 모델. 미설정 시 풀이 검토 모델 사용                                     |
| `PROJECT_BROWSER_SNAPSHOT_ID` | 공개 프로젝트의 JS 실행과 화면 수집용 Vercel Sandbox 스냅샷 ID                                     |
| `OPENAI_GUIDE_MODEL`          | 핏 시작 가이드 기본 `gpt-5.6-luna`                                                                 |
| `OPENAI_PROJECT_MODEL`        | 내 프로젝트 분석과 질문 생성 기본 `gpt-5.6-sol`, `medium` 추론                                     |
| `OPENAI_PROJECT_REVIEW_MODEL` | 내 프로젝트 답변 평가 기본 `gpt-5.6-luna`, `medium` 추론                                           |
| `DATABASE_URL`                | PostgreSQL 연결 주소. Vercel에서 필수                                                              |
| `DATABASE_PATH`               | SQLite 절대 경로. 기본 `data/recode.sqlite`                                                        |
| `RATE_LIMIT_SALT`             | Vercel에서 접속 IP를 HMAC으로 변환할 비밀 값. 32바이트 이상 난수 권장                              |
| `APP_ORIGIN`                  | 프록시 운영 시 실제 HTTPS origin. 끝의 `/` 제외                                                    |

비밀 값은 `NEXT_PUBLIC_*`나 Git에 넣지 않습니다. `.env.local`, `.vercel`, 데이터베이스, 테스트 임시 데이터는 Git에서 제외됩니다.

```bash
npm run build
npm start
```

독립 실행 빌드 외부에 SQLite 파일을 두므로 재빌드 후에도 기록이 유지됩니다. 운영 사이트는 GitHub `main`에 푸시하면 Vercel이 자동 배포합니다. Production과 Preview는 별도의 PostgreSQL을 사용하며 각각 서버 키와 `RATE_LIMIT_SALT`를 설정합니다. 배포 보호 설정은 환경별로 확인하세요. Preview 주소가 Vercel 로그인으로 연결될 수 있으므로 공개 체험 링크에는 접근 가능한 운영 주소를 사용합니다.

## 코드 이해 훈련의 실행 환경

`npm ci`의 postinstall은 Monaco와 고정 버전 QuickJS WASM 파일을 `public/`에 복사합니다.
로컬 실행과 Vercel 빌드 모두 같은 경로를 사용합니다. 생성된 자산은 Git에 넣지 않습니다.
QuickJS 0.32.0의 파일명을 바꿀 때에는 복사 스크립트와 Worker 경로를 함께 갱신하세요.

브라우저 Worker가 QuickJS를 실행하며 서버에는 사용자 코드를 실행하는 API가 없습니다.
한 테스트당 600ms, 16MiB 힙, 256KiB 스택, 출력 1,600자 제한과 전체 12초 Worker 종료를 적용합니다.
새 런타임을 테스트마다 만들며 DOM, 네트워크, 파일 시스템, 타이머나 모듈 로더를 노출하지 않습니다.
입력은 교육용 JavaScript 함수에 한정합니다. 모바일의 메모리 부족이나 WASM 차단 시에도 초안은 보존됩니다.

두 훈련의 맞춤 질문 API는 풀이 검토와 모델 설정 및 사용량 한도를 공유합니다. 최초 구현은 유료 호출 없이 provider mock과 브라우저 모의 응답으로 검증했습니다.
실제 모델의 질문 품질과 학습 효과는 별도 실사용 평가가 필요합니다.

## 검증 재현

변경한 기능에 해당하는 테스트부터 실행합니다. 예를 들어 공통 화면과 배너 변경은 빌드 후 `npx playwright test e2e/experience-ui.spec.ts`로 확인할 수 있습니다. 아래는 수동 전체 검증 절차이며, 작은 변경마다 모두 실행해야 한다는 뜻은 아닙니다.

GitHub Actions는 푸시와 PR에서 포맷, 린트, 타입, 미사용 코드와 단위 테스트를 검사합니다. 전체 빌드와 3개 브라우저 테스트는 Actions의 `Run workflow`에서 `full_browser_tests`를 선택했을 때만 실행합니다. 같은 브랜치에 새 실행이 시작되면 이전 실행은 취소합니다. Vercel 자동 배포는 이 CI와 독립적으로 빌드하며, CI 완료를 기다리는 배포 차단 설정은 현재 적용하지 않습니다.

```bash
npm run format:check
npm run lint
npm run typecheck
npm run check:unused
npm test
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
npm run benchmark
```

`npm run typecheck`는 `next typegen`으로 이미지 및 라우트 타입을 준비한 뒤 TypeScript를 검사합니다. 새 체크아웃에는 자동 생성 파일인 `next-env.d.ts`가 없으므로, 빌드 후 남은 파일에 의존해 `tsc`만 실행하지 않습니다.

브라우저 테스트는 자동으로 별도 SQLite 서버를 시작합니다. 실행 중인 서버를 임의로 재사용하지 않으며 API 키도 비웁니다. 직접 검증 서버를 준비한 경우에만 `CODEFIT_E2E_EXTERNAL_SERVER=1`을 지정하세요. PostgreSQL 검증은 **테스트 전용 DB**를 `TEST_DATABASE_URL`에 지정합니다. 이 변수가 없으면 PostgreSQL 테스트는 건너뜁니다. 설정된 경우 매번 임시 스키마를 만들고, 스키마 격리를 확인한 후 테스트합니다. GitHub Actions는 별도 PostgreSQL 16 서비스를 사용합니다.

```bash
# 유료 API 호출: 최대 16회, 동시 2회. .env.local의 기존 키 사용
npm run eval:ai -- --live
```

키를 설정한 임시 로컬 서버에서는 `npm run test:ai-live -- --live`로 생성, 검토, 영구 저장, 멱등 재요청과 사용량 기록을 함께 검증할 수 있습니다. 실제 유료 요청은 2회입니다. 먼저 테스트 전용 로그인 세션을 준비해야 하며 `VERIFY_COOKIE_FILE`에 해당 쿠키 파일 경로를 지정합니다. OAuth 운영 설정은 [인증 안내](authentication.md)를 참고하세요.

로컬 유료 통합 검증은 아래처럼 전용 DB와 테스트 서명을 사용합니다. 운영에는 이 테스트 서명을 사용하지 않습니다. 첫 번째 터미널에서 서버를 실행하고, 두 번째 터미널에서 세션을 준비한 뒤 검증합니다. `.env.local`에 `OPENAI_API_KEY`가 있어야 합니다.

```bash
# 터미널 1: 빌드 후 임시 로컬 서버 실행
DATABASE_PATH="$PWD/artifacts/oauth-live.sqlite" DATABASE_URL='' VERCEL='' \
AUTH_BASE_URL=http://127.0.0.1:3012 \
BETTER_AUTH_SECRET=codefit-isolated-test-secret-never-use-in-production \
PORT=3012 HOSTNAME=127.0.0.1 npm start
```

```bash
# 터미널 2: 쿠키를 화면에 출력하지 않고 테스트용 파일로 저장
node --import tsx --input-type=module <<'JS'
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { testAccount } from './scripts/lib/test-account.ts';
const fixture = await testAccount(resolve('artifacts/oauth-live.sqlite'), 'http://127.0.0.1:3012');
writeFileSync('artifacts/oauth-live-cookie.txt', fixture.cookie, { mode: 0o600 });
fixture.store.db.close();
JS
VERIFY_BASE_URL=http://127.0.0.1:3012 VERIFY_COOKIE_FILE=artifacts/oauth-live-cookie.txt npm run test:ai-live -- --live
```

일반 테스트와 CI는 유료 AI를 호출하지 않습니다. 평가 명령은 실제 결과를 `reports/ai-evaluation.json`에 기록하며 오답 통과, 정답 거절, 제공자 오류가 있으면 실패 종료합니다. API 통합 검증은 임시 서버에 `VERIFY_BASE_URL=http://127.0.0.1:3012 npm run test:api`로 실행합니다. 이 명령은 운영 URL에 테스트 데이터를 쓰지 못하도록 제한했습니다.

## 백업과 구조

사용자 기록 내보내기와 운영 DB 보관/이관은 서로 다른 기능입니다. 웹 JSON 백업은 최대 4,000,000바이트이며 보안 점검의 탭 임시 기록과 미제출 초안은 제외합니다. [백업 계약](workspace-backup.md)이 포함 범위와 복원 정책의 기준입니다.

| 방법                   | 포함 범위                                                                                   | 복원 방법                                     |
| ---------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 서비스의 v3 JSON 백업  | 본인과 연결된 문제, 코딩 진도/제출, 입문 기록, 완료된 프로젝트 분석·평가·학습 기록과 이미지 | 서비스에서 가져오기. 기존 기록은 유지         |
| 미션별 텍스트 내보내기 | 입문 예상, 관찰, 수정 요청과 검사 요약                                                      | 읽기/보관용. 앱으로 가져오기는 미지원         |
| SQLite 파일 백업       | 인증과 입문 기록을 포함한 DB 전체                                                           | 앱을 종료한 뒤 파일 복원                      |
| SQLite→PostgreSQL 이관 | 계정/연결, 문제, 코딩·입문 기록, 완료된 프로젝트·학습 기록, 생성 사용량과 AI 계측           | 운영자용 명령. 대상의 기존 행은 덮어쓰지 않음 |

```bash
npm run backup -- /safe-backups/codefit.sqlite
npm run migrate:postgres -- data/recode.sqlite .vercel/.env.production.local
```

SQLite backup API로 실행 중인 WAL 데이터베이스의 일관된 스냅샷을 만듭니다. 복원은 앱을 종료하고 현재 DB와 `-wal`, `-shm` 파일을 별도 보관한 뒤 진행합니다. PostgreSQL은 제공자의 백업이나 `pg_dump`를 사용합니다. 이전 스크립트는 기존 대상 기록을 덮어쓰지 않으며 검색 테이블은 앱 시작 시 원본 문제로 채워집니다. 계정도 옮길 때는 같은 `BETTER_AUTH_SECRET`을 대상에 설정해야 OAuth 토큰을 읽을 수 있습니다. 세션과 인증 중 상태는 옮기지 않으므로 다시 로그인해야 합니다.

`src/components`는 화면, `src/hooks`는 상태와 저장 흐름, `src/lib`는 공통 모델, `src/lib/server`는 요청 검증, 저장소와 AI를 담당합니다. 핵심 파일의 책임과 선택한 설계의 한계는 [engineering.md](engineering.md)에 정리했습니다.

이관 대상/변환 규칙은 `scripts/lib/migration-data.mjs`, PostgreSQL 쓰기 트랜잭션은 `scripts/migrate-sqlite-to-postgres.mjs`에 있습니다. 입문 기록은 테이블이 있는 원본에서만 읽으므로 이전 버전 DB도 지원합니다. 완료된 프로젝트 점검은 복사하지만 실행 중인 AI 작업과 세션은 복사하지 않으며, 진행 중인 요청과 쓰기를 멈춘 뒤 이관합니다. 조회용 문제 목록은 대상 앱이 시작할 때 재구성합니다. 이관 결과의 `learning_progress.source`와 `inserted`를 확인하고, 대상에 같은 소유자/미션 기록이 있으면 삽입 수가 작아질 수 있습니다.

## 코드 리비전과 AI 작업 마이그레이션

2026-09-14부터 코드 PUT에는 서버 상세 응답의 `progress.codeRevision`을 `baseRevision`으로 전달합니다. 진도가 없으면 기준은 0입니다. 코드 없는 북마크 PUT에는 필요하지 않습니다. 409 `code_conflict` 응답의 `current`는 비교용이며, 사용자 확인 없이 새 기준으로 재전송하면 안 됩니다. 428은 구형 클라이언트의 무조건 저장을 거절한 것입니다.

앱 초기화는 기존 데이터에 `progress.code_revision`, `jobs.token`, `jobs.fingerprint`, `generation_usage.token` 열을 추가합니다. SQLite는 버전 2 마이그레이션을 쓰기 트랜잭션으로, PostgreSQL은 기존 초기화 advisory lock으로 직렬화합니다. 기존 코드와 제출은 그대로 유지합니다. SQLite→PostgreSQL 이관은 리비전을 보존하며, 이전 스키마의 코드는 기준값을 부여합니다. 작업을 처리하는 구버전 서버를 종료한 후 배포/이관하고, 코드 리비전과 토큰 검사를 하지 않는 버전으로 되돌려 운영하지 마세요. 이관 중 쓰기를 허용하는 무중단 데이터 이동은 지원하지 않습니다.

이전 작업에는 지문을 복원할 원문 입력이 없으므로 그 ID의 재사용을 거절합니다. 브라우저에서 새로고침 후 새 ID로 요청할 수 있습니다. 작업 행은 실패해도 내용 지문을 유지합니다. 보관 기간/정리 정책을 나중에 추가할 때는 ID를 지운 뒤 재사용되는 범위를 별도로 정의해야 합니다.

2026-09-14 성능 비교는 별도 로컬 DB에 당시 내장 문제 12개를 넣은 프로덕션 서버로 진행했습니다. 현재 기본 시드는 24개이므로 과거 수치를 재현할 때는 당시 커밋과 데이터 규모를 함께 맞춰야 합니다. E2E용 DB와 섞지 말고, 다른 브라우저 테스트와 동시에 실행하지 마세요. 서버 시작 후 예열 접속을 한 뒤 아래 명령을 변경 전후 각각 실행합니다.

```bash
npm run measure:interactions -- before
npm run measure:interactions -- after
```

각 명령은 새 게스트로 데스크톱 5회, 제한된 모바일 조건 5회를 실행합니다. 원시 값은 `reports/interactions-*.json`, 첫 반복의 CDP 성능 기록은 `artifacts/performance-*/`에 저장합니다. 이번 공개한 성능 기록은 테스트 코드만 포함한 압축본이며 `reports/traces/`에서 압축을 풀어 Chrome DevTools Performance로 열 수 있습니다. 목록/편집기 수치는 자동화가 표시/편집 가능 상태를 확인한 시간입니다. INP, 운영 지연이나 실제 사용자 통계로 인용하지 않습니다.

## 모델 비교 재현

```bash
# 실제 API 호출: 16개 사례를 2회, 총 32회. 기존 보고서 보존
npm run eval:ai -- --live --model gpt-5.6-luna --repeat 2 --output reports/ai-review-luna.json
# 모델별 12회. 동일하게 terra/sol로도 실행
npm run eval:generation -- --live --model gpt-5.6-luna
# 검토된 원문 해시가 같은 일부 Python 반례만 실행
python3 scripts/check-generation-counterexamples.py
```

생성 도구는 실행 전 모든 주제를 앱의 입력 스키마로 확인하고, 호출마다 결과를 저장합니다. `--resume`은 이전 보고서의 입력/모델/프롬프트 버전이 같은 완료 호출을 재사용합니다. 이미 호출한 실패도 덮어쓰지 않습니다. 원래 미호출 fixture만 입력을 고쳐 보충할 수 있습니다. 새 평가를 할 때는 이전 보고서를 별도로 보관하세요. 정답 품질은 구조화 출력 성공률과 별도로 확인해야 합니다. 일반 CI는 이 유료 평가를 실행하지 않습니다.

## 인수인계 훈련 로컬 검증

로컬 앱의 `/handoff`에서 기본 6개와 변형 6개를 연습합니다. 새 데이터는 기존 문제 초기화 과정에 추가되므로 전체 내장 문제는 24개입니다. 이전의 내장 12개 기준 성능 기록은 당시의 데이터 규모이며 이번 변경의 성능 측정값이 아닙니다.

```bash
npm test
npm run build
npm run test:e2e
npm run eval:handoff
# 유료 호출이 필요할 때만 실행 (13건 / 보완본은 별도 6건)
npm run eval:handoff -- --live
npm run eval:handoff -- --strengthened --live
```

일반 단위/브라우저 검증은 AI 키를 사용하지 않습니다. 브라우저 테스트의 AI 응답 지연/오류는 명시적으로 모의 처리하고, 실제 모델 검사는 별도 로컬 보고서에 기록합니다. 평가 도구는 `gpt-5.6-luna`와 현재 인수인계 지침을 사용합니다. `--live` 없이 입력 개수만 확인할 수 있습니다. 보고서에는 최초 예상과 다른 판정도 보존합니다.

브라우저 검증은 `artifacts/e2e.sqlite`와 테스트 계정을 사용합니다. 이전 실행의 사용량 제한이 남았다면 서버를 종료하고 기존 테스트 DB 및 WAL/SHM을 별도 폴더에 보존한 뒤 새 DB에서 실행하세요. 운영 DB와 실제 로컬 연습 DB는 사용하거나 초기화하지 마세요. 기존 충돌 스크린샷도 재실행 때 과거 문서를 덮어쓰지 않도록 `artifacts/`에 저장합니다.

## 입문 트랙 개발

`/learn`에서 코스를 고르고 `/learn/[id]`에서 연습한다. `GET /api/learn`은 현재 소유자의 기록, `GET/PUT /api/learn/[id]`는 개별 기록의 조건부 읽기/쓰기를 제공한다. `POST /api/learn/[id]/coach`는 기존 리뷰 모델 및 사용량 한도를 공유한다. 미션과 기록 스키마는 `src/lib/learn/`, 모의 앱과 단계 화면은 `src/components/learn/`에 있다.

`learning_progress` 테이블은 기존 공유 스키마 초기화 때 생성된다. 새 환경 변수나 외부 인프라는 필요하지 않다. 입문 기록은 사용자용 v3 JSON 백업의 내보내기/가져오기에 포함하며, 미션별 텍스트 내보내기도 제공한다. 운영용 전체 SQLite 스냅샷과 SQLite→PostgreSQL 이관에는 포함된다.

`npm test`로 모의 동작과 저장 계약을, `npx playwright test e2e/beginner.spec.ts`로 현재 카탈로그의 미션과 배너의 브라우저 흐름을 검사한다. E2E는 기존처럼 운영 DB/AI 키를 비운 격리 서버를 사용한다. 기본 테스트 주소는 `http://127.0.0.1:3012`이며 3010 미리보기와 분리한다. `e2e/service-domains.spec.ts`와 `e2e/simulation-voice.spec.ts`는 현재 공개된 21개 실습과 서비스 화면을 확인한다.

## 내 프로젝트 점검

`/project-check`와 `/api/project-check`는 게스트 체험과 로그인 계정의 분석/평가를 제공합니다. 이용 한도와 기록 보관 범위는 README를 참고하세요. 기존 서버 API 키와 DB를 재사용합니다. 자바스크립트 실행 후 화면 수집에는 Vercel Sandbox 스냅샷과 프로젝트 범위 인증이 추가로 필요합니다. [브라우저 수집 준비](project-browser.md#브라우저-이미지-준비)에 따라 `PROJECT_BROWSER_SNAPSHOT_ID`를 설정하세요. 설정이 없거나 수집에 실패하면 HTML 수집으로 전환하며, 렌더링된 화면을 읽었다고 표시하지 않습니다. 주소 수집 제한, 개인 한도, 실패 시 차감 정책과 모델 비용은 [설계 기록](project-check.md)에 있습니다. SQLite→PostgreSQL 이관에서는 완료된 프로젝트 질문과 평가만 복사하고 진행 중인 AI 작업은 제외합니다. 일반 DB 백업에도 기록이 포함됩니다.

## 미리보기와 검증 환경 구분

로컬 `.env.local`에 OAuth 제공자 키가 없다면 로그인은 비활성화된다. 기능 삭제나 운영 장애를 뜻하지 않는다. 로컬 로그인 화면에는 설정이 없는 상태와 운영 로그인 링크가 표시된다. [로컬 콜백과 별도 OAuth 앱 설정](authentication.md#서버-환경-변수)을 완료해야 로컬에서 실제 로그인이 가능하다.

브라우저 테스트의 기본 포트는 **3012**이며 `scripts/lib/e2e-environment.ts`가 테스트 코드와 Playwright 설정의 주소를 공유한다. `CODEFIT_E2E_BASE_URL`로 다른 로컬 주소를 지정할 수 있지만 운영 호스트는 거부한다. 기존 3010 미리보기나 실제 연습 DB를 종료·초기화하지 않는다. 테스트 DB는 `artifacts/e2e.sqlite`, OAuth는 테스트 세션, AI 응답은 모의 데이터다.

프로젝트 질문 비교 도구는 `npm run eval:project -- --model gpt-5.6-luna`로 호출 수만 확인한다. 실제 과금 실행에는 환경에 API 키를 로드하고 `--snapshot <공개 페이지 스냅샷> --live`를 명시한다. [동일 입력의 모델 비교](project-check.md)에 사용량과 한계를 기록했다.
