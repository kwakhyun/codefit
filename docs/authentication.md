# OAuth 로그인과 생성 한도

Google과 GitHub를 지원합니다. 로그인 성공 시 계정이 자동 생성됩니다. 별도 비밀번호 가입은 없습니다. 문제 생성과 개인 프로필만 인증을 요구하며, 나머지 풀이 기능은 게스트도 사용할 수 있습니다.

## 서버 환경 변수

| 변수                                       | 값                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `AUTH_BASE_URL`                            | 서비스의 고정 origin. 운영 `https://codefit-five.vercel.app`         |
| `BETTER_AUTH_SECRET`                       | 최소 32자 이상의 암호학적 난수. 세션 서명과 OAuth 토큰 암호화에 사용 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google 웹 OAuth 클라이언트                                           |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth 앱                                                      |
| `OPENAI_GENERATION_MODEL`                  | 기본 `gpt-5.6-sol`                                                   |
| `OPENAI_REVIEW_MODEL`                      | 기본 `gpt-5.6-luna`, medium 추론                                     |

모두 서버 전용입니다. Vercel에서는 비밀키를 **Secret** 유형으로 저장하고 `NEXT_PUBLIC_` 접두사를 사용하지 않습니다. 설정 변경 후 새 배포가 필요합니다. 제공자 키가 누락되면 해당 버튼은 ‘연결 준비 중’으로 표시됩니다. 키가 없는 상태를 정상 로그인으로 표시하지 않습니다.

## 제공자 설정

Google Cloud에서 웹 애플리케이션 OAuth 클라이언트를 만들고 리디렉션 URI를 `https://codefit-five.vercel.app/api/auth/callback/google`로 지정합니다. 공개 서비스는 외부 사용자, 프로덕션 게시 상태로 설정해야 합니다. 기본 `openid`, `email`, `profile` 범위만 사용하며 Drive나 Gmail 권한은 요청하지 않습니다. 앱 홈과 개인정보 안내는 각각 서비스 루트와 `/privacy`입니다.

GitHub OAuth 앱은 홈페이지를 `https://codefit-five.vercel.app`, 콜백을 `https://codefit-five.vercel.app/api/auth/callback/github`로 지정합니다. 요청 범위는 `read:user`, `user:email`입니다. 저장소 권한은 없습니다. 와일드카드 콜백은 사용하지 않습니다.

로컬 개발은 별도 OAuth 앱 또는 명시적으로 허용한 로컬 콜백을 사용하고 `AUTH_BASE_URL=http://localhost:3000`으로 맞춥니다. Preview도 고정된 테스트 도메인과 별도 OAuth 앱/DB/비밀키를 사용하세요. Production 키를 임의의 Preview 도메인과 공유하지 않습니다. 동적 Preview 주소는 기본적으로 OAuth 연결을 제공하지 않습니다.

## 계정과 개인정보

Better Auth 1.7.4가 OAuth 상태, PKCE, HttpOnly 쿠키와 DB 세션을 처리합니다. 세션은 30일, 활동 시 갱신 주기는 1일입니다. Google/GitHub의 동일 이메일을 암묵적으로 합치지 않습니다. 먼저 기존 계정으로 로그인하고 프로필에서 같은 이메일의 다른 제공자를 명시적으로 연결하세요. 연결 후에는 같은 계정 ID와 한도를 사용합니다.

게스트의 기존 `recode_session` 쿠키와 소유자 해시는 유지합니다. 로그인 후에는 계정 ID에 풀이를 저장합니다. 게스트 코딩 기록을 합치려면 게스트 상태에서 내보낸 JSON 백업을 로그인 후 가져옵니다. 입문 미션 기록은 자동 병합이나 가져오기를 지원하지 않으며, 미션별 텍스트 내보내기로 보관합니다. 기존 작성 코드를 보존하며 중복 제출은 다시 추가하지 않습니다. 미저장 로컬 초안도 소유자별로 분리됩니다. 사용자용 백업에는 OAuth 토큰이나 세션이 포함되지 않습니다.

## 하루 3회

계정별로 한국 시간 00:00부터 다음 00:00까지 성공한 생성 3회를 제공합니다. 진행 중인 요청도 임시로 자리를 차지합니다. 실패하면 반환하며 프로세스 중단으로 남은 예약은 150초 후 만료합니다. 완료된 생성과 한도 반영은 같은 트랜잭션입니다. 재시도는 기존 결과를 반환합니다. 별도의 접속망/서비스 공용 호출 한도는 실패도 차감하며 `/api/usage`의 개인 잔여량보다 먼저 제한될 수 있습니다.

## 확인

`npm test`는 모의 GitHub 응답으로 실제 OAuth 시작, 콜백, 세션, 프로필 수정, 로그아웃과 상태 변조를 검증합니다. `TEST_DATABASE_URL`이 설정된 경우에만 격리된 PostgreSQL 스키마에서 동시 생성 3회 제한, 실패 반환과 자정 갱신 테스트를 실행합니다. 미설정 시 해당 테스트는 건너뛰며, CI에는 별도 PostgreSQL 서비스가 준비됩니다. 브라우저 테스트는 격리된 로컬 DB에 테스트 세션을 준비하며 운영에 테스트 로그인 API를 추가하지 않습니다. 2026-09-13 운영 배포에서 Google과 GitHub의 실제 로그인 및 콜백을 확인했습니다. 운영 설정 변경 시 이 흐름을 다시 확인하세요.
