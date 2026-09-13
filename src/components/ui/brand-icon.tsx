import Image from "next/image";

/** Decorative beside the CODE:FIT wordmark; the link supplies its accessible name. */
export function BrandIcon({ size = 34 }: { size?: number }) {
  return (
    <Image
      src="/brand/codefit-icon.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className="brand-icon"
      unoptimized
    />
  );
}
