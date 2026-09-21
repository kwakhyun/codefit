"use client";

import Image, { type ImageProps } from "next/image";
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
  return (
    <picture className="theme-picture">
      <source srcSet={lightSrc} media={media} />
      <Image {...props} src={src} alt={alt} unoptimized />
    </picture>
  );
}
