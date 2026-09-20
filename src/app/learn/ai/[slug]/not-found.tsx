import { AppLink as Link } from "@/components/ui/primitives";
export default function AiLessonNotFound() {
  return (
    <main className="learn-page ai-empty">
      <h1>이 수업을 찾을 수 없어요</h1>
      <p>주소를 확인하거나 전체 수업에서 다시 골라 주세요.</p>
      <Link className="primary-button" href="/learn/ai">
        AI 수업 목록으로
      </Link>
    </main>
  );
}
