import { AccountShell } from "@/components/account/account-shell";
export const metadata = { title: "개인정보 안내 | CODE:FIT" };
export default function PrivacyPage() {
  return (
    <AccountShell>
      <article className="profile-content privacy-copy">
        <span className="eyebrow">PRIVACY</span>
        <h1>연습 기록과 계정 정보</h1>
        <p>적용일: 2026년 9월 13일</p>
        <h2>로그인 없이 연습할 때</h2>
        <p>
          무작위 브라우저 쿠키로 풀이 코드, 북마크, 힌트 열람과 학습 기록을 구분합니다. 쿠키는 최대
          1년 동안 유지됩니다. 쿠키를 지우면 기존 기록에 다시 접근하지 못할 수 있어 환경 설정의 백업
          기능을 권장합니다.
        </p>
        <h2>Google 또는 GitHub로 로그인할 때</h2>
        <p>
          계정 식별자, 이름, 이메일과 프로필 이미지 주소를 로그인 제공자에서 받아 계정을 생성합니다.
          프로필의 소개는 선택 사항입니다. 비밀번호는 수집하지 않으며 Google Drive 파일이나 GitHub
          저장소를 읽을 권한을 요청하지 않습니다. 로그인 세션은 최대 30일이며 프로필에서 다른 기기의
          세션을 종료할 수 있습니다. 로그인 세션에는 접속 IP와 브라우저 정보도 저장됩니다. OAuth
          토큰은 암호화해 저장합니다.
        </p>
        <h2>AI에 전달되는 내용</h2>
        <p>
          문제 생성 시 선택한 분야, 언어, 난이도, 주제와 중복 방지용 문제 제목을 OpenAI에
          전달합니다. 풀이 검토 시 문제와 제출 코드를 전달합니다. 이름, 이메일, 소개는 프롬프트에
          포함하지 않습니다. 코드나 주제에 비밀번호, API 키, 개인 정보를 입력하지 마세요. OpenAI
          요청은 store:false로 전송합니다. 공급자의 API 데이터 보관 정책은 별도로 적용됩니다.
        </p>
        <h2>저장과 공유</h2>
        <p>
          생성한 문제는 공개 보관함에 영구 저장되어 누구나 풀 수 있습니다. 개인의 풀이 코드, 진도와
          프로필은 다른 이용자에게 공개하지 않습니다. 로그인 후 기록은 계정에 저장되며 로그인 전
          기록과 자동으로 합쳐지지 않습니다. 일일 생성 한도를 계정에 저장하고, 남용 방지를 위해
          접속망을 비밀키로 해시한 값을 일시적으로 사용합니다. Vercel에서 서비스를 제공하며 Neon
          PostgreSQL에 데이터를 저장합니다.
        </p>
        <h2>정보 관리와 문의</h2>
        <p>
          프로필에서 이름과 소개를 수정하고 환경 설정에서 기록을 내려받을 수 있습니다. 계정 정보와
          기록 삭제 등 문의는{" "}
          <a href="https://github.com/kwakhyun" target="_blank" rel="noreferrer">
            운영자 GitHub 프로필
          </a>
          의 연락처를 이용해 주세요. 공개 이슈에 이메일이나 비공개 코드를 게시하지 마세요.
        </p>
      </article>
    </AccountShell>
  );
}
