"use client";

import Image, { getImageProps, type ImageProps } from "next/image";
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
  // Both themes go through the image optimizer with the same width, height and sizes, so the
  // <source> offers the light file at the same candidate widths as the <img>.
  const light = getImageProps({
    ...props,
    src: src.replace("/images/", "/images/light/"),
    alt,
  }).props;
  const dark = getImageProps({ ...props, src, alt }).props;
  const [lightSrc, lightSrcSet, lightSizes] = [light.src, light.srcSet, light.sizes];
  const [darkSrc, darkSrcSet, darkSizes] = [dark.src, dark.srcSet, dark.sizes];
  useEffect(() => {
    const image = imageRef.current;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    if (status !== "loaded" || !image || connection?.saveData) return;
    // Only prepare artwork actually on screen, after the current image has loaded.
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      if (matchMedia(media).matches) warmImage(darkSrc, darkSrcSet, darkSizes);
      else warmImage(lightSrc, lightSrcSet, lightSizes);
      observer.disconnect();
    });
    observer.observe(image);
    return () => observer.disconnect();
  }, [status, media, lightSrc, lightSrcSet, lightSizes, darkSrc, darkSrcSet, darkSizes]);
  return (
    <picture className="theme-picture" data-image-state={status}>
      <source srcSet={lightSrcSet} sizes={lightSizes} media={media} />
      <Image
        ref={imageRef}
        {...props}
        src={src}
        alt={alt}
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
function warmImage(src: string, srcSet?: string, sizes?: string) {
  const key = srcSet || src;
  if (warmedImages.has(key)) return;
  const image = new window.Image();
  image.fetchPriority = "low";
  warmedImages.set(key, image);
  // Same candidates as the visible <img>, so the browser picks the file a toggle will show.
  if (sizes) image.sizes = sizes;
  if (srcSet) image.srcset = srcSet;
  image.src = src;
  void image.decode().catch(() => {
    // A later visit can retry; failed prefetches never block the theme toggle.
    warmedImages.delete(key);
  });
}
