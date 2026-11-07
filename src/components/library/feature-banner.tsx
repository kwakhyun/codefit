"use client";
import { AppLink as Link, Button } from "@/components/ui/primitives";
import { allowanceSummary } from "@/lib/ai-access";
import {
  ArrowRight,
  BookOpen,
  LayoutGrid,
  ShieldCheck,
  Sparkles,
  Terminal,
  Workflow,
  type LucideIcon,
} from "lucide-react";

const features: { title: string; description: string; href: string; icon: LucideIcon }[] = [
  {
    title: "서비스 보안 점검",
    description: "공개 보안 설정과 소유한 주소의 응답을 확인하고 재검사 기록으로 이어가요.",
    href: "/security-check",
    icon: ShieldCheck,
  },
  {
    title: "AI 실무 배우기",
    description: "AI 도구의 개념을 익히고 모의 실습으로 활용 방법을 확인해요.",
    href: "/learn/ai",
    icon: Workflow,
  },
  {
    title: "AI 코드 이해 훈련",
    description: "실행 결과를 예상하고, 코드를 고친 뒤 동작을 내 말로 설명해요.",
    href: "/handoff?source=sample",
    icon: Terminal,
  },
  {
    title: "서비스 원리 배우기",
    description: "예제 서비스를 조작하며 저장, 통신, 접근 권한이 동작하는 원리를 배워요.",
    href: "/learn?source=sample",
    icon: BookOpen,
  },
  {
    title: "분야별 코딩 연습",
    description: "분야와 난이도를 골라 직접 코드를 작성하고 AI 풀이 검토를 받아요.",
    href: "/?view=browse",
    icon: LayoutGrid,
  },
];

/** A still overview of the other tools on the first-visit home; the menu has the same names. */
export function FeatureOverview({ onGenerate }: { onGenerate: () => void }) {
  return (
    <section className="feature-overview" aria-labelledby="feature-overview-title">
      <h2 id="feature-overview-title">이런 기능도 있어요</h2>
      <ul>
        {features.map(({ title, description, href, icon: Icon }) => (
          <li key={href}>
            <Link href={href}>
              <Icon size={20} aria-hidden="true" />
              <strong>{title}</strong>
              <span>{description}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </li>
        ))}
        <li>
          <Button
            onClick={(event) => {
              // Safari does not focus clicked buttons; give the dialog a return target.
              event.currentTarget.focus();
              onGenerate();
            }}
          >
            <Sparkles size={20} aria-hidden="true" />
            <strong>AI 문제 생성</strong>
            <span>
              원하는 분야와 난이도로 연습 문제를 만들어요. {allowanceSummary("generate")}.
            </span>
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </li>
      </ul>
    </section>
  );
}
