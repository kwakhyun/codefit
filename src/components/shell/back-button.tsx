"use client";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";

/** Returns to the previous screen, or home when this page was opened directly. */
export function BackButton() {
  const router = useRouter();
  return (
    <Button
      className="secondary-button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
    >
      <ArrowLeft size={17} aria-hidden="true" />
      이전 페이지로
    </Button>
  );
}
