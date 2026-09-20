import type { ReactNode } from "react";
import { SectionArtwork, type ArtworkTopic } from "./section-artwork";
export function VisualIntro({
  topic,
  children,
  className = "",
}: {
  topic: ArtworkTopic;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`visual-intro ${className}`}>
      <div className="visual-intro-copy">{children}</div>
      <SectionArtwork topic={topic} eager />
    </section>
  );
}
