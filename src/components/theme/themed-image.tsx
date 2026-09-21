"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "./theme-provider";

/** Picture selects one file; OS media provides the initial source until hydration. */
export function ThemedImage({ src, alt, ...props }: Omit<ImageProps, "src"> & { src: string }) {
  const { preference, resolved } = useTheme();
  const media =
    preference === "system"
      ? "(prefers-color-scheme: light)"
      : resolved === "light"
        ? "all"
        : "not all";
  const lightSrc = src.replace("/images/", "/images/light/");
  const selectedSrc = resolved === "light" ? lightSrc : src;
  return <ImageState key={selectedSrc} {...props} src={src} alt={alt} media={media} />;
}

function ImageState({
  src,
  alt,
  media,
  onLoad,
  onError,
  ...props
}: Omit<ImageProps, "src"> & { src: string; media: string }) {
  const [status, setStatus] = useState("loading");
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const image = imageRef.current;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    if (status !== "loaded" || !image || connection?.saveData) return;
    // Only prepare artwork actually on screen, after the current image has loaded.
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      const lightSrc = src.replace("/images/", "/images/light/");
      const alternate = image.currentSrc.includes("/images/light/") ? src : lightSrc;
      warmImage(alternate);
      observer.disconnect();
    });
    observer.observe(image);
    return () => observer.disconnect();
  }, [src, status]);
  return (
    <picture className="theme-picture" data-image-state={status}>
      <source srcSet={src.replace("/images/", "/images/light/")} media={media} />
      <Image
        ref={imageRef}
        {...props}
        src={src}
        alt={alt}
        unoptimized
        onLoad={(event) => {
          setStatus("loaded");
          onLoad?.(event);
        }}
        onError={(event) => {
          setStatus("error");
          onError?.(event);
        }}
      />
    </picture>
  );
}

// Share in-flight requests across banners and cards using the same artwork.
const warmedImages = new Map<string, HTMLImageElement>();
function warmImage(src: string) {
  if (warmedImages.has(src)) return;
  const image = new window.Image();
  image.fetchPriority = "low";
  warmedImages.set(src, image);
  image.src = src;
  void image.decode().catch(() => {
    // A later visit can retry; failed prefetches never block the theme toggle.
    warmedImages.delete(src);
  });
}
