"use client";
import { useState } from "react";
import { scenarioFor } from "@/lib/scenario-visuals";
import { ScenarioVisual } from "./scenario-visual";

export function ScenarioWalkthrough({ problemId }: { problemId: string }) {
  const [stage, setStage] = useState(0);
  const scene = scenarioFor(problemId);
  if (!scene) return null;
  return (
    <div className="scenario-walkthrough">
      <ScenarioVisual scene={scene} stage={stage} />
      <div className="scenario-controls" role="group" aria-label="상황 그림 단계">
        {["상황", "확인할 점", "수정과 검사", "응용"].map((label, index) => (
          <button
            key={label}
            type="button"
            tabIndex={0}
            aria-pressed={stage === index}
            onClick={() => setStage(index)}
          >
            {index + 1}. {label}
          </button>
        ))}
      </div>
    </div>
  );
}
