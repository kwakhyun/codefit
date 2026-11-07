import { AppLink as Link } from "@/components/ui/primitives";

export function AppFooter() {
  return (
    <footer className="app-footer">
      <p>
        <span className="mono">CODE:FIT</span>
        <span>
          학습용 연습 서비스입니다. AI 피드백은 실제 서비스의 검증이나 보안 인증을 대신하지
          않습니다.
        </span>
      </p>
      <Link href="/privacy">개인정보 안내</Link>
    </footer>
  );
}
