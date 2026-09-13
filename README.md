# CODE:FIT — AI 시대의 코딩 근력

**AI가 코드를 짜도, 내 실력은 녹슬지 않게.**

AI 에이전트에게 코딩을 맡기는 개발자가 직접 구현하고, 오류의 원인을 찾고, 코드를 개선하는 감각을 유지하도록 만든 코딩 훈련 서비스입니다. AI가 출제한 실전 문제를 직접 풀고, 단계별 힌트와 코드 리뷰로 부족한 부분을 돌아봅니다.

CODE:FIT은 코딩 실력을 꾸준히 관리한다는 뜻입니다. 검정 터미널 테마, 문제 보관함, Monaco 편집기로 훈련에 집중할 수 있도록 구성했습니다.

## 제공 기능

- 10개 분야: 프론트엔드, 백엔드, 게임 개발, 네트워크, 데이터베이스, 인프라 / DevOps, 모바일, 데이터 / AI, 보안, 시스템 / 알고리즘
- 26개 언어와 형식: JavaScript, TypeScript, React / TSX, HTML, CSS, Python, Java, Go, C#, C++, C, Rust, PHP, Ruby, Kotlin, Swift, Dart, Lua, GDScript, SQL, Shell, Dockerfile, YAML, Terraform / HCL, R, Julia
- 기능 구현, 오류 수정, 리팩터링 유형과 상 / 중 / 하 난이도
- 요구사항과 입출력 예시를 갖춘 내장 문제 12개
- OpenAI Responses API와 구조화된 출력으로 맞춤 문제 생성
- 단계별 힌트 3개, 참고 정답, 해설. 처음에는 정답과 힌트를 클라이언트로 보내지 않음
- 실제 요구사항에 따라 대체 구현도 검토하는 AI 코드 리뷰. 모든 요구사항을 충족할 때만 해결 완료 처리
- PostgreSQL(클라우드) 또는 SQLite(로컬)에 생성 문제, 개인별 코드 초안, 힌트 사용, 북마크, 제출 코드, 피드백 영구 저장
- 제목과 키워드 검색, 분야 / 언어 / 난이도 / 유형 / 출처 / 풀이 상태 필터, 정렬과 페이지 이동
- 자동 저장, 브라우저 임시 복구본, 저장 실패 재시도, 집중 모드, 글자 크기, 줄바꿈과 단축키
- 모바일 화면, 모달 포커스 관리, 키보드 탭 탐색, 모션 감소 설정 대응
- 전체 문제와 개인 기록 JSON 내보내기 / 가져오기, 실행 중 DB의 안전한 스냅샷 백업
- 기존 `recode-progress-v1` 데이터는 삭제하지 않고 서버에 별도 보관. 내보내기 `legacy` 항목에서 확인 가능

**AI 검토는 정적 코드 리뷰입니다.** 서버에서 학습자 코드를 실행하지 않으며 컴파일 성공, 테스트 통과, 성능 측정을 주장하지 않습니다. 외부 의존성이 있는 문제는 설명에 해당 실행 환경을 명시합니다. GDScript 편집기는 Python 기반 문법 강조를 사용하고 전용 언어 서버는 포함하지 않습니다.

## 로컬 개발

Node.js **22.13 이상**이 필요합니다. Docker는 22.21을 사용합니다. 내장 `node:sqlite`를 사용하므로 추가 DB 서버가 필요하지 않습니다.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

이미 `.env.local`이 있으면 복사하지 않고 기존 설정을 유지하세요. 기본 주소는 [localhost:3000](http://localhost:3000)이며 이번 작업의 검증 화면은 [127.0.0.1:3010](http://127.0.0.1:3010)입니다.

환경 변수:

| 이름 | 용도 |
| --- | --- |
| `OPENAI_API_KEY` | AI 생성과 코드 검토에 사용하는 서버 전용 키 |
| `OPENAI_MODEL` | 사용할 모델. 기존 프로젝트 기본값 `gpt-5.4-mini` 유지 |
| `DATABASE_URL` | 클라우드 PostgreSQL 연결 주소. Vercel에서는 필수이며 설정 시 SQLite 대신 사용 |
| `DATABASE_PATH` | SQLite 파일의 절대 경로. 미설정 시 `data/recode.sqlite` |
| `LAB_ACCESS_TOKEN` | 연습실 접근 암호. **프로덕션 실행 시 필수** |
| `APP_ORIGIN` | 외부에서 접속하는 정확한 origin. 프록시 운영 시 `https://lab.example.com`처럼 설정하며 끝에 `/`를 넣지 않음 |

API 키 없이도 내장 문제, 편집, 저장, 힌트와 정답은 동작합니다. 생성과 AI 검토는 비활성화되고 필요한 설정을 안내합니다. 키 값은 브라우저에 전달하지 않습니다.

## 프로덕션 운영

**Vercel + Neon PostgreSQL** 배포와 로컬 SQLite 실행을 지원합니다. `DATABASE_URL`이 있으면 중앙 PostgreSQL을 사용하며, Vercel에서 이 값이 없으면 임시 SQLite로 저장하지 않고 설정 오류를 반환합니다. SQLite로 운영할 때는 영구 디스크가 있는 단일 서버나 컨테이너를 사용하세요.

GitHub의 `main` 브랜치가 Vercel 프로덕션 배포 소스입니다. 변경 사항 미리보기는 별도의 PostgreSQL 저장소를 사용합니다. `.github/workflows/ci.yml`은 PostgreSQL 테스트 서비스에서 저장·동시 요청 검증, 린트, 빌드를 수행합니다.

Vercel 환경 변수는 Production과 Preview 각각에 `DATABASE_URL`, `OPENAI_API_KEY`, `LAB_ACCESS_TOKEN`을 등록합니다. 호스팅 연결 정보, API 키, 접근 암호, 로컬 DB는 Git에 포함하지 않습니다.

```bash
npm run build
npm start
```

`npm start`는 독립 실행 빌드에 정적 파일을 복사하고, DB 경로를 빌드 폴더 외부의 `data/recode.sqlite`로 고정한 뒤 시작합니다. 재빌드해도 기록이 사라지지 않습니다. 위 실행에는 `.env.local`의 `LAB_ACCESS_TOKEN`이 필요합니다. 접속하면 암호 입력 화면이 표시됩니다. Vercel의 자동 배포는 Git 연동을 사용하며 이 로컬 실행 명령과 별개입니다.

Docker 예시:

```bash
docker build -t codefit-lab .
docker volume create recode-data
docker run --name codefit-lab --restart unless-stopped \
  --env-file .env.local \
  -p 127.0.0.1:3000:3000 \
  -v recode-data:/data \
  codefit-lab
```

공개 운영 시 HTTPS 리버스 프록시를 앞에 두고 `APP_ORIGIN`을 실제 HTTPS origin으로 설정하세요. 요청 URL과 Origin 검증, JSON 입력 및 바이트 제한, 세션 쿠키, AI 호출 제한, 구조 검증, 멱등 요청 처리, 기본 보안 헤더를 적용했습니다. 접근 암호는 환경 변수로 관리하고 `.env.local`은 이미지와 Git에 포함하지 않습니다.

- 문제 은행은 연습실 전체에서 공유합니다.
- 개인 진도는 무작위 HttpOnly 쿠키로 식별하며 DB에는 쿠키의 해시를 저장합니다. 별도의 이메일 계정과 기기 간 자동 동기화는 포함하지 않습니다.
- 다른 브라우저에서 이어 풀려면 환경 설정에서 백업을 내보낸 뒤 가져오세요. 새 문제와 기록을 추가하며 이미 작성한 코드는 덮어쓰지 않습니다.
- 개인 AI 한도: 24시간 창 기준 생성 20회, 검토 60회. 서버 전체 한도: 1시간 창 기준 100회. 실패 요청도 한도에 포함합니다. DB에 기록하므로 재시작으로 초기화되지 않습니다.
- 접근 암호 변경은 기존 접근 인증을 무효화합니다. 로그인 시도는 서버 전체 10분당 30회로 제한합니다.
- AI 피드백은 확정적인 실행 검증이 아닙니다. 문제 은행이 커지면 전문 실행 샌드박스, 계정 인증, 서버 측 목록 검색과 페이지 조회를 별도 확장할 수 있습니다.

## 백업과 복구

설정의 JSON 내보내기는 **전체 문제(정답 포함)**와 현재 브라우저의 학습 기록을 포함합니다. 가져오기는 최대 10 MB, 문제 2,500개, 풀이 10,000개를 지원합니다. 이전 버전 예제는 별도 원본 보관이며 새 문제로 자동 변환하지 않습니다.

로컬 SQLite의 모든 사용자 데이터와 호출 제한, 작업 이력을 포함한 백업:

```bash
npm run backup
# 또는 대상 파일 지정
npm run backup -- /safe-backups/recode-2026-09-13.sqlite
```

SQLite backup API로 실행 중인 WAL DB를 일관된 스냅샷으로 저장합니다. DB 파일 하나를 단순 복사하는 방식 대신 이 명령을 사용하세요. 저장된 백업은 다른 디스크나 외부 보관소에도 복제하세요.

복구 시 앱을 종료하고, 현재 DB와 연결된 `-wal`, `-shm` 파일을 함께 별도 위치에 보관한 뒤 백업 파일을 `DATABASE_PATH` 위치로 복사하고 재시작합니다. 기존 데이터를 지우거나 덮어쓰는 복구 작업은 자동 실행하지 않습니다.

PostgreSQL은 호스팅 제공자의 백업과 `pg_dump`를 사용하세요. 기존 SQLite 데이터를 클라우드로 옮길 때는 다음 명령을 사용합니다. 연결 설정 파일은 Git에서 제외된 경로에 둡니다.

```bash
node scripts/migrate-sqlite-to-postgres.mjs data/recode.sqlite .vercel/.env.production.local
```

이전은 트랜잭션으로 처리하며 기존 클라우드 문제와 기록을 덮어쓰지 않습니다. 브라우저 쿠키는 도메인별이므로, 로컬 진도를 새 도메인에서 사용하려면 개인 기록 백업을 가져오세요.

## 검증

```bash
npm test
npm run lint
npm run build
```

자동 테스트는 분야와 문제 구조, 입력 검증, 정답 비노출, 검토 기준 완결성, 사용자별 저장 격리, DB 재시작 후 보존, 초안 덮어쓰기 방지, 힌트 상한, 멱등 요청, 요청 제한과 Origin 검증을 확인합니다. 기존 MVP 데이터 / 비교 함수의 회귀 테스트도 유지합니다.

프로덕션 API 통합 검증은 별도의 임시 DB로 서버를 실행한 뒤 `VERIFY_BASE_URL`과 테스트 암호 `VERIFY_ACCESS_TOKEN`을 지정해 `npm run test:api`로 실행합니다. 인증, 세션 격리, 입력 제한, 힌트, 정답, 백업 복원을 확인하며 현재 사용자 DB를 대상으로 실행하지 않습니다.

실제 AI 호출은 자동 테스트에 포함하지 않아 반복 검증 시 과금되지 않습니다. 실제 생성과 풀이 검토는 실행 중 앱에서 확인합니다.

## 주요 구조

- `src/components/practice-app.tsx`: 보관함, 검색과 필터, 학습 기록, 설정
- `src/components/lab/problem-workspace.tsx`: 풀이, 자동 저장, 힌트 / 정답 / 기록과 AI 리뷰
- `src/components/lab/generator.tsx`: 맞춤 문제 생성
- `src/components/code-editor.tsx`: 로컬 Monaco 편집기
- `src/lib/catalog.ts`: 분야와 언어 목록
- `src/data/problems.ts`: 실전 내장 문제
- `src/lib/problem.ts`: 문제와 리뷰 스키마
- `src/lib/server/store.ts`: SQLite 스키마, 저장과 트랜잭션
- `src/lib/server/ai.ts`: OpenAI 생성과 검토
- `src/lib/server/http.ts`: 세션, 입력 크기와 호출 제한, 오류 응답
- `src/app/api`: 생성, 조회, 저장, 힌트, 검토, 내보내기 / 가져오기, 접근 인증

구현 참고: [OpenAI 구조화된 응답](https://github.com/openai/openai-node/blob/main/docs/structured-outputs.md), [Node.js SQLite](https://nodejs.org/api/sqlite.html). Next.js 동작은 프로젝트에 설치된 `node_modules/next/dist/docs/` 문서를 기준으로 확인했습니다.
