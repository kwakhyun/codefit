import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProviderIcon } from "./provider-icon";

/** Parent renders only after the current account has resolved to a guest. */
export function GuestLogin({ returnTo }: { returnTo: string }) {
  return (
    <aside className="guest-login">
      <Link className="guest-login-link" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
        <span>간편 로그인하고 AI 기능 사용하기</span>
        <ArrowRight size={17} aria-hidden="true" />
      </Link>
      <span className="guest-login-providers">
        <span>
          <ProviderIcon provider="google" />
          Google
        </span>
        <span>
          <ProviderIcon provider="github" />
          GitHub
        </span>
      </span>
    </aside>
  );
}
