import Image from "next/image";
import { SCENES, type SceneKey } from "@/lib/scenario-visuals";

/** One image request serves all four scenes; captions carry the equivalent meaning. */
export function ScenarioImage({ scene, stage = 0 }: { scene: SceneKey; stage?: number }) {
  const frame = Math.max(0, Math.min(3, stage));
  return (
    <span className="scenario-art" data-frame={frame} aria-hidden="true">
      <Image
        src={`/images/scenarios/${scene}.webp`}
        alt=""
        unoptimized
        width={1024}
        height={1024}
        sizes="(max-width: 600px) 320px, 448px"
        draggable={false}
        style={{ left: `${(frame % 2) * -100}%`, top: `${Math.floor(frame / 2) * -100}%` }}
      />
    </span>
  );
}
export function ScenarioVisual({ scene, stage = 0 }: { scene: SceneKey; stage?: number }) {
  const item = SCENES[scene];
  const frame = Math.max(0, Math.min(3, stage));
  return (
    <figure className="scenario-visual" data-scene={scene} data-stage={frame}>
      <ScenarioImage scene={scene} stage={frame} />
      <figcaption>
        <span className="eyebrow">그림으로 보는 상황</span>
        <strong>{item.title}</strong>
        <p>{item.steps[frame]}</p>
      </figcaption>
    </figure>
  );
}
