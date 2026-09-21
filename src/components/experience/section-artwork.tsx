import { ThemedImage } from "@/components/theme/themed-image";
export type ArtworkTopic = "principles" | "code" | "project" | "security" | "progress";
export function SectionArtwork({
  topic,
  className = "",
  eager = false,
}: {
  topic: ArtworkTopic;
  className?: string;
  eager?: boolean;
}) {
  return (
    <div className={`section-artwork ${className}`} aria-hidden="true">
      <ThemedImage
        src={`/images/experience/${topic}.webp`}
        width={960}
        height={640}
        alt=""
        loading={eager ? "eager" : "lazy"}
        sizes="(max-width: 720px) 90vw, 440px"
        unoptimized
      />
    </div>
  );
}
