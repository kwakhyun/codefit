import { ScreenSkeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <main className="route-loading">
      <ScreenSkeleton variant="editor" />
    </main>
  );
}
