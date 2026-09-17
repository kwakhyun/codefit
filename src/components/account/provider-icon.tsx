import Image from "next/image";
import type { OAuthProvider } from "@/lib/auth-types";

export function ProviderIcon({ provider }: { provider: OAuthProvider }) {
  return (
    <Image
      className={`provider-icon provider-${provider}`}
      src={`/brand/providers/${provider === "google" ? "google.png" : "github.svg"}`}
      width={20}
      height={20}
      alt=""
      aria-hidden="true"
      unoptimized
    />
  );
}
