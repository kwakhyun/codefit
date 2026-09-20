import { ArrowRight, Workflow } from "lucide-react";
import { AppLink as Link } from "@/components/ui/primitives";
import { AI_LESSONS, AI_TRACKS } from "@/lib/ai-learning/catalog";

export function AiLearningEntry() {
  return (
    <Link className="ai-learning-entry" href="/learn/ai">
      <Workflow aria-hidden="true" size={28} />
      <div>
        <span className="eyebrow">
          {AI_TRACKS.length}개 분야, {AI_LESSONS.length}개 수업
        </span>
        <strong>AI 도구, 어디서부터 배울까요?</strong>
        <p>LangChain과 LangGraph부터 로컬 AI, 문서 검색, 업무 자동화까지</p>
      </div>
      <span className="ai-entry-action">
        AI 실무 배우기 <ArrowRight aria-hidden="true" size={18} />
      </span>
    </Link>
  );
}
