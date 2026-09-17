import Image from "next/image";
import codefitIcon from "../../../public/brand/codefit-icon.png";

/** Decorative beside the CODE:FIT wordmark; the link supplies its accessible name. */
export function BrandIcon({ size = 34 }: { size?: number }) {
  return (
    <Image
      src={codefitIcon}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className="brand-icon"
      unoptimized
    />
  );
}
