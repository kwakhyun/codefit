"use client";
import { useEffect } from "react";
import { Home, RotateCcw } from "lucide-react";
import { AppLink as Link, Button } from "@/components/ui/primitives";

/** Replaces only the page: the menu, header and settings stay usable. */
export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main-content" tabIndex={-1} className="status-page">
      <span className="eyebrow">일시적인 오류</span>
      <h1>화면을 표시하지 못했습니다</h1>
      <p>
        잠시 후 다시 시도해 주세요. 작성 중이던 코드와 답변은 저장된 범위까지 유지됩니다. 같은
        문제가 반복되면 새로고침하거나 홈에서 다시 시작해 주세요.
      </p>
      {error.digest && <p className="muted">오류 번호: {error.digest}</p>}
      <div className="status-page-actions">
        <Button className="primary-button" onClick={() => retry()}>
          <RotateCcw size={17} aria-hidden="true" />
          다시 시도
        </Button>
        <Link className="secondary-button" href="/">
          <Home size={17} aria-hidden="true" />
          홈으로
        </Link>
      </div>
    </main>
  );
}
