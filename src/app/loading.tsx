import { LoadingState } from "@/components/ui/loading-state";
export default function Loading() {
  return (
    <main id="main-content" className="route-loading">
      <LoadingState>화면을 준비하고 있습니다</LoadingState>
    </main>
  );
}
