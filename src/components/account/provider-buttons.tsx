"use client";
import { useState } from "react";
import { GitBranch, Check, LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import type { OAuthProvider } from "@/lib/auth-types";

export function ProviderButtons({
  providers,
  returnTo,
  linked,
}: {
  providers: OAuthProvider[];
  returnTo: string;
  linked?: string[];
}) {
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState("");
  async function connect(provider: OAuthProvider) {
    setBusy(provider);
    setError("");
    try {
      const response = linked
        ? await authClient.linkSocial({
            provider,
            callbackURL: "/profile",
            errorCallbackURL: "/profile?error=link",
          })
        : await authClient.signIn.social({
            provider,
            callbackURL: returnTo,
            errorCallbackURL: `/login?returnTo=${encodeURIComponent(returnTo)}`,
          });
      if (response.error)
        throw new Error("로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } catch {
      setError("Google 또는 GitHub에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setBusy(null);
    }
  }
  return (
    <div className="oauth-providers">
      {(["google", "github"] as const).map((provider) => {
        const connected = linked?.includes(provider);
        const enabled = providers.includes(provider);
        return (
          <button
            className="secondary-button oauth-button"
            key={provider}
            disabled={Boolean(busy) || connected || !enabled}
            onClick={() => void connect(provider)}
          >
            {busy === provider ? (
              <LoaderCircle size={19} className="spin" />
            ) : provider === "github" ? (
              <GitBranch size={19} />
            ) : (
              <span className="google-symbol" aria-hidden="true">
                G
              </span>
            )}
            <span>
              {provider === "google" ? "Google" : "GitHub"}
              {linked ? " 계정" : "로 계속하기"}
            </span>
            {connected ? (
              <>
                <small>연결됨</small>
                <Check size={16} />
              </>
            ) : !enabled ? (
              <small>연결 준비 중</small>
            ) : linked ? (
              <small>연결하기</small>
            ) : null}
          </button>
        );
      })}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {!providers.length && (
        <p className="inline-warning">
          로그인 연결을 준비 중입니다. 보관함의 모든 문제는 지금도 풀 수 있습니다.
        </p>
      )}
    </div>
  );
}
