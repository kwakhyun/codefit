# CODE:FIT 개발과 운영

서비스 소개는 [README](../README.md), 설계 근거는 [engineering.md](engineering.md)를 참고하세요.

## 로컬 실행

Node.js 22.13 이상이 필요합니다. Docker 없이 SQLite로 실행할 수 있습니다.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

기존 `.env.local`이 있으면 덮어쓰지 마세요. 기본 주소는 `http://localhost:3000`입니다. OAuth를 사용하면 아래 `AUTH_BASE_URL`과 콜백 주소도 같은 주소로 맞춥니다. API 키 없이도 내장 문제, 코드 작성/저장, 힌트, 정답, 백업을 사용할 수 있습니다.

| 환경 변수                 | 용도                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`          | 서버 전용 AI 키. 생성과 검토에 사용                                                    |
| `OPENAI_GENERATION_MODEL` | 문제 생성 기본 `gpt-5.6-sol` (GPT-5.6 Sol)                                             |
| `OPENAI_REVIEW_MODEL`     | 풀이 검토 기본 `gpt-5.4-mini`, `medium` 추론. 이전 `OPENAI_MODEL`은 검토에만 호환 적용 |
| `DATABASE_URL`            | PostgreSQL 연결 주소. Vercel에서 필수                                                  |
| `DATABASE_PATH`           | SQLite 절대 경로. 기본 `data/recode.sqlite`                                            |
| `RATE_LIMIT_SALT`         | Vercel에서 접속 IP를 HMAC으로 변환할 비밀 값. 32바이트 이상 난수 권장                  |
| `APP_ORIGIN`              | 프록시 운영 시 실제 HTTPS origin. 끝의 `/` 제외                                        |

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

키를 설정한 임시 로컬 서버에서는 `npm run test:ai-live -- --live`로 생성, 검토, 영구 저장, 멱등 재요청과 사용량 기록을 함께 검증할 수 있습니다. 실제 유료 요청은 2회입니다. 먼저 테스트 전용 로그인 세션을 준비해야 하며 `VERIFY_COOKIE_FILE`에 해당 쿠키 파일 경로를 지정합니다. OAuth 운영 설정은 [인증 안내](authentication.md)를 참고하세요.

로컬 유료 통합 검증은 아래처럼 전용 DB와 테스트 서명을 사용합니다. 운영에는 이 테스트 서명을 사용하지 않습니다. 첫 번째 터미널에서 서버를 실행하고, 두 번째 터미널에서 세션을 준비한 뒤 검증합니다. `.env.local`에 `OPENAI_API_KEY`가 있어야 합니다.

```bash
# 터미널 1: 빌드 후 임시 로컬 서버 실행
DATABASE_PATH="$PWD/artifacts/oauth-live.sqlite" DATABASE_URL='' VERCEL='' \
AUTH_BASE_URL=http://127.0.0.1:3010 \
BETTER_AUTH_SECRET=codefit-isolated-test-secret-never-use-in-production \
PORT=3010 HOSTNAME=127.0.0.1 npm start
```

```bash
# 터미널 2: 쿠키를 화면에 출력하지 않고 테스트용 파일로 저장
node --import tsx --input-type=module <<'JS'
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { testAccount } from './scripts/lib/test-account.ts';
const fixture = await testAccount(resolve('artifacts/oauth-live.sqlite'), 'http://127.0.0.1:3010');
writeFileSync('artifacts/oauth-live-cookie.txt', fixture.cookie, { mode: 0o600 });
fixture.store.db.close();
JS
VERIFY_COOKIE_FILE=artifacts/oauth-live-cookie.txt npm run test:ai-live -- --live
```

일반 테스트와 CI는 유료 AI를 호출하지 않습니다. 평가 명령은 실제 결과를 `reports/ai-evaluation.json`에 기록하며 오답 통과, 정답 거절, 제공자 오류가 있으면 실패 종료합니다. API 통합 검증은 임시 서버에 `VERIFY_BASE_URL=http://127.0.0.1:3010 npm run test:api`로 실행합니다. 이 명령은 운영 URL에 테스트 데이터를 쓰지 못하도록 제한했습니다.

## 백업과 구조

```bash
npm run backup -- /safe-backups/codefit.sqlite
npm run migrate:postgres -- data/recode.sqlite .vercel/.env.production.local
```

SQLite backup API로 실행 중인 WAL 데이터베이스의 일관된 스냅샷을 만듭니다. 복원은 앱을 종료하고 현재 DB와 `-wal`, `-shm` 파일을 별도 보관한 뒤 진행합니다. PostgreSQL은 제공자의 백업이나 `pg_dump`를 사용합니다. 이전 스크립트는 기존 대상 기록을 덮어쓰지 않으며 검색 테이블은 앱 시작 시 원본 문제로 채워집니다. 계정도 옮길 때는 같은 `BETTER_AUTH_SECRET`을 대상에 설정해야 OAuth 토큰을 읽을 수 있습니다. 세션과 인증 중 상태는 옮기지 않으므로 다시 로그인해야 합니다.

`src/components`는 화면, `src/hooks`는 상태와 저장 흐름, `src/lib`는 공통 모델, `src/lib/server`는 요청 검증, 저장소와 AI를 담당합니다. 핵심 파일의 책임과 선택한 설계의 한계는 [engineering.md](engineering.md)에 정리했습니다.
