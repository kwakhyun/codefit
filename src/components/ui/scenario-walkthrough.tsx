"use client";
import { useFadeTransition } from "@/components/ui/use-fade-transition";
import { ToggleButton } from "@/components/ui/primitives";
import { useState } from "react";
import { scenarioFor } from "@/lib/scenario-visuals";
import { ScenarioVisual } from "./scenario-visual";

export function ScenarioWalkthrough({ problemId }: { problemId: string }) {
  const [stage, setStage] = useState(0);
  const fade = useFadeTransition<HTMLDivElement>(stage);
  const scene = scenarioFor(problemId);
  if (!scene) return null;
  return (
    <div ref={fade} className="scenario-walkthrough">
      <ScenarioVisual scene={scene} stage={stage} />
      <div className="scenario-controls" role="group" aria-label="상황 그림 단계">
        {["상황", "확인할 점", "수정과 검사", "응용"].map((label, index) => (
          <ToggleButton
            key={label}
            type="button"
            tabIndex={0}
            aria-pressed={stage === index}
            onClick={() => setStage(index)}
          >
            {index + 1}. {label}
          </ToggleButton>
        ))}
      </div>
    </div>
  );
}
