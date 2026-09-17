import Image from "next/image";
import mascot from "../../../public/brand/fit-mascot.webp";

export function FitMascot({ size = 64 }: { size?: number }) {
  return (
    <Image
      src={mascot}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className="fit-mascot"
      unoptimized
    />
  );
}
