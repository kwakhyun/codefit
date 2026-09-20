"use client";
import { Button, Status, Anchor } from "@/components/ui/primitives";
import { useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { ProviderIcon } from "./provider-icon";
import { authClient } from "@/lib/auth-client";
import type { OAuthProvider } from "@/lib/auth-types";

export function ProviderButtons({
  providers,
  returnTo,
  linked,
  localPreview = false,
}: {
  providers: OAuthProvider[];
  returnTo: string;
  linked?: string[];
  localPreview?: boolean;
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
          <Button
            className="secondary-button oauth-button"
            key={provider}
            disabled={Boolean(busy) || connected || !enabled}
            onClick={() => void connect(provider)}
          >
            {busy === provider ? (
              <LoaderCircle size={19} className="spin" />
            ) : (
              <ProviderIcon provider={provider} />
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
              <small>사용 불가</small>
            ) : linked ? (
              <small>연결하기</small>
            ) : null}
          </Button>
        );
      })}
      {error && (
        <Status className="inline-error" role="alert">
          {error}
        </Status>
      )}
      {!providers.length && (
        <p className="inline-warning">
          {localPreview ? (
            <>
              로컬 미리보기에는 로그인 설정이 없습니다.{" "}
              <Anchor href="https://codefit-five.vercel.app/login" target="_blank" rel="noreferrer">
                운영 사이트에서 로그인하기 ↗
              </Anchor>
            </>
          ) : (
            "지금은 로그인을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요."
          )}
        </p>
      )}
    </div>
  );
}
