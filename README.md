# CODE:FIT — AI 시대의 코딩 근력

**AI가 코드를 짜도, 내 실력은 녹슬지 않게.**

[바로 사용하기](https://codefit-five.vercel.app) · [AI 검증 결과](https://codefit-five.vercel.app/quality) · [설계와 검증 근거](docs/engineering.md)

가입이나 암호 없이 사용할 수 있는 코딩 훈련 서비스입니다. AI에게 구현을 맡기는 개발자가 자신의 문제 해결 감각을 유지하도록 만들었습니다. 예제를 따라 쓰는 대신 기능 구현, 버그 수정, 리팩터링 문제를 직접 풀고 요구사항별 피드백을 받습니다.

![검정 터미널 테마의 문제 보관함](docs/images/library.png)

## 사용 흐름

1. 분야와 난이도로 문제를 고르거나 원하는 주제로 AI 문제를 생성합니다.
2. Monaco 편집기에서 직접 풉니다. 코드는 자동 저장되며 연결이 끊기면 브라우저에 보관합니다.
3. 막히면 단계별 힌트 3개를 확인하고, 참고 정답과 자신의 풀이를 비교합니다.
4. AI가 요구사항별로 검토합니다. 이전 제출본을 다시 열고 수정하거나 변경을 취소할 수 있습니다.

10개 분야와 26개 언어/기술, 상/중/하 난이도, 내장 문제 12개를 제공합니다. 생성한 문제는 PostgreSQL에 계속 쌓이며, 풀이와 북마크는 개인 브라우저별로 구분합니다. 검색 조건이 유지되는 탐색, 모바일 화면, 집중 모드, 글자 크기, 키보드 단축키, 최근 7일 훈련 기록, JSON 백업 복원을 지원합니다.

**AI 검토는 정적 코드 리뷰입니다.** 제출 코드를 실행하거나 컴파일하지 않습니다. 통과 표시는 실행 결과를 보장하지 않으며 다른 올바른 구현도 오판할 수 있습니다.

![문제와 코드를 함께 보는 풀이 화면](docs/images/workspace.png)

[모바일 화면 보기](docs/images/mobile.png)

## 직접 확인할 구현과 근거

| 영역       | 구현                                                                                   | 검증 근거                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 프론트엔드 | 요청 취소와 오래된 응답 무시, 저장 대기열, 오프라인 복구, URL 상태, 포커스 복원        | [Playwright와 axe 테스트](e2e/practice.spec.ts)                                                               |
| 백엔드     | 공통 저장소 인터페이스, 원자적 제출/생성, 멱등 요청, 서버 검색, 커서 이력 조회         | [SQLite/실제 PostgreSQL 공통 검증](src/lib/server/query-contract.test-helper.ts)                              |
| 조회 성능  | 검색용 테이블과 인덱스, 페이지당 8개 응답, 코드 단건 조회                              | [5,012개 문제 실험](reports/storage-benchmark.json): 목록 1,993,608 → 3,354 bytes                             |
| AI 활용    | Responses API 구조화된 출력, 요구사항 검증, 프롬프트 버전, 추론 수준 비교, 사용량 계측 | [16개 고정 사례와 실제 응답](reports/ai-evaluation.json), [변경 전 결과](reports/ai-evaluation-baseline.json) |
| 운영       | Vercel 자동 배포, 별도 Preview DB, GitHub Actions, 세션/접속망/전체 AI 한도            | [CI](.github/workflows/ci.yml), [공개 이용 정책](src/lib/server/usage-policy.ts)                              |

최종 AI 평가에서는 16/16개 통과 여부와 52/52개 요구사항 판정이 작성한 기준과 일치했습니다. 작은 개발용 데이터에 대한 한 번의 측정이며, 모든 언어의 정확도나 독립적인 외부 평가 결과로 해석하지 않습니다. 실패했던 중간 결과와 비용/지연의 변화도 [설계 문서](docs/engineering.md)에 남겼습니다.

## 로컬 실행

Node.js 22.13 이상이 필요합니다. Docker 없이 SQLite로 실행할 수 있습니다.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

기존 `.env.local`이 있으면 덮어쓰지 마세요. 기본 주소는 `http://localhost:3000`입니다. API 키 없이도 내장 문제, 코드 작성/저장, 힌트, 정답, 백업을 사용할 수 있습니다.

| 환경 변수         | 용도                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`  | 서버 전용 AI 키. 생성과 검토에 사용                                                    |
| `OPENAI_MODEL`    | 기본 `gpt-5.4-mini`. 검토 시 `medium` 추론을 사용하므로 해당 옵션을 지원하는 모델 필요 |
| `DATABASE_URL`    | PostgreSQL 연결 주소. Vercel에서 필수                                                  |
| `DATABASE_PATH`   | SQLite 절대 경로. 기본 `data/recode.sqlite`                                            |
| `RATE_LIMIT_SALT` | Vercel에서 접속 IP를 HMAC으로 변환할 비밀 값. 32바이트 이상 난수 권장                  |
| `APP_ORIGIN`      | 프록시 운영 시 실제 HTTPS origin. 끝의 `/` 제외                                        |

비밀 값은 `NEXT_PUBLIC_*`나 Git에 넣지 않습니다. `.env.local`, `.vercel`, 데이터베이스, 테스트 임시 데이터는 Git에서 제외됩니다.

```bash
npm run build
npm start
```

독립 실행 빌드 외부에 SQLite 파일을 두므로 재빌드 후에도 기록이 유지됩니다. 운영 사이트는 GitHub `main`에 푸시하면 Vercel이 자동 배포합니다. Production과 Preview는 별도의 PostgreSQL을 사용하며 각각 서버 키와 `RATE_LIMIT_SALT`를 설정합니다. 접근 암호는 사용하지 않습니다.

## 검증 재현

```bash
npm run format:check
npm run lint
npm run typecheck
npm run check:unused
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run benchmark
```

브라우저 테스트는 자동으로 별도 SQLite 서버를 시작합니다. 실행 중인 서버를 임의로 재사용하지 않으며 API 키도 비웁니다. 직접 검증 서버를 준비한 경우에만 `CODEFIT_E2E_EXTERNAL_SERVER=1`을 지정하세요. PostgreSQL 검증은 **테스트 전용 DB**를 `TEST_DATABASE_URL`에 지정합니다. 매번 임시 스키마를 만들고, 스키마 격리를 확인한 후 테스트합니다. GitHub Actions는 별도 PostgreSQL 16 서비스를 사용합니다.

```bash
# 유료 API 호출: 최대 16회, 동시 2회. .env.local의 기존 키 사용
npm run eval:ai -- --live
```

키를 설정한 임시 로컬 서버에서는 `npm run test:ai-live -- --live`로 생성, 검토, 영구 저장, 멱등 재요청과 사용량 기록을 함께 검증할 수 있습니다. 실제 유료 요청은 2회입니다.

일반 테스트와 CI는 유료 AI를 호출하지 않습니다. 평가 명령은 실제 결과를 `reports/ai-evaluation.json`에 기록하며 오답 통과, 정답 거절, 제공자 오류가 있으면 실패 종료합니다. API 통합 검증은 임시 서버에 `VERIFY_BASE_URL=http://127.0.0.1:3010 npm run test:api`로 실행합니다. 이 명령은 운영 URL에 테스트 데이터를 쓰지 못하도록 제한했습니다.

## 공개 이용과 보관

- 문제는 공유되고 코드는 개인 브라우저의 무작위 HttpOnly 쿠키로 구분됩니다. DB에는 쿠키 원문 대신 해시를 저장합니다. 기존 쿠키와 기록은 유지됩니다.
- 기기 간 자동 동기화나 이메일 계정은 없습니다. 쿠키를 삭제하기 전 환경 설정에서 백업을 내보내세요.
- 개인 AI 한도는 첫 요청부터 24시간 동안 생성 5회, 검토 20회입니다. 같은 접속망은 각각 10/40회, 서비스 전체는 시간당 40회와 24시간당 100회입니다. 실패 요청도 차감하며 재시작해도 초기화되지 않습니다.
- 이용 현황에서 개인 잔여 횟수, 갱신 시각, 최근 30일 처리 시간과 토큰 사용량을 확인할 수 있습니다. 제공자에게 보낸 코드 원문은 사용량 로그에 남기지 않습니다.
- 백업은 최대 10MB, 문제 2,500개와 풀이 10,000개를 읽습니다. 공개 복원 한도는 하루 신규 문제 총 100개, 제출 기록 총 10,000개이며 개인 5회, 접속망 10회, 서비스 전체 20회입니다. 기존 문제와 작성 코드는 덮어쓰지 않습니다.

## 백업과 구조

```bash
npm run backup -- /safe-backups/codefit.sqlite
npm run migrate:postgres -- data/recode.sqlite .vercel/.env.production.local
```

SQLite backup API로 실행 중인 WAL 데이터베이스의 일관된 스냅샷을 만듭니다. 복원은 앱을 종료하고 현재 DB와 `-wal`, `-shm` 파일을 별도 보관한 뒤 진행합니다. PostgreSQL은 제공자의 백업이나 `pg_dump`를 사용합니다. 이전 스크립트는 기존 대상 기록을 덮어쓰지 않으며 검색 테이블은 앱 시작 시 원본 문제로 채워집니다.

`src/components`는 화면, `src/hooks`는 상태와 저장 흐름, `src/lib`는 공통 모델, `src/lib/server`는 요청 검증, 저장소와 AI를 담당합니다. 핵심 파일의 책임과 선택한 설계의 한계는 [engineering.md](docs/engineering.md)에 정리했습니다.
