import { AppLink as Link } from "@/components/ui/primitives";
import { ArrowRight } from "lucide-react";
import { ProviderIcon } from "./provider-icon";

/** Parent renders only after the current account has resolved to a guest. */
export function GuestLogin({
  returnTo,
  compact = false,
  label = "로그인하고 AI 이용 횟수 늘리기",
}: {
  returnTo: string;
  label?: string;
  compact?: boolean;
}) {
  return (
    <aside className={`guest-login${compact ? " guest-login-compact" : ""}`}>
      <Link className="guest-login-link" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
        <span>{label}</span>
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
