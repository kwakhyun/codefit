"use client";
import { Status, Button, Card, FieldLabel, Input, Textarea } from "@/components/ui/primitives";
import { VisualIntro } from "@/components/experience/visual-intro";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Check, LoaderCircle, LogOut, Save } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { api, errorMessage } from "@/lib/client-api";
import type { AccountUser, OAuthProvider } from "@/lib/auth-types";
import type { Workspace } from "@/lib/problem";
import { ProviderButtons } from "./provider-buttons";
import { AiUsage } from "../shell/ai-usage";
type ProfileData = {
  user: AccountUser;
  linkedProviders: string[];
  stats: Workspace["stats"];
  training: Workspace["training"];
};
export function Profile({
  initialUser,
  providers,
}: {
  initialUser: AccountUser;
  providers: OAuthProvider[];
}) {
  const [name, setName] = useState(initialUser.name);
  const [bio, setBio] = useState(initialUser.bio);
  const [data, setData] = useState<ProfileData | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const params = useSearchParams();
  useEffect(() => {
    const controller = new AbortController();
    api<ProfileData>("/api/profile", { signal: controller.signal, scope: `user:${initialUser.id}` })
      .then(setData)
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorMessage(error));
      });
    return () => controller.abort();
  }, [retry, initialUser.id]);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await api("/api/profile", {
        method: "PATCH",
        body: { name, bio },
        scope: `user:${initialUser.id}`,
      });
      setSaved(true);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function signOut(all: boolean) {
    setBusy(true);
    setError("");
    try {
      if (all) {
        const result = await authClient.revokeOtherSessions();
        if (result.error) throw new Error("다른 기기의 로그아웃에 실패했습니다.");
      }
      const result = await authClient.signOut();
      if (result.error) throw new Error("로그아웃에 실패했습니다.");
      // Drop all in-memory account data after revoking the session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch (error) {
      setError(errorMessage(error));
      setBusy(false);
    }
  }
  return (
    <div className="profile-content">
      <VisualIntro topic="progress" className="compact-visual-intro">
        <span className="eyebrow">MY TRAINING PROFILE</span>
        <h1>내 프로필과 학습 현황</h1>
        <p className="muted">
          {initialUser.email} / 가입일 {new Date(initialUser.createdAt).toLocaleDateString("ko-KR")}
        </p>
      </VisualIntro>
      {data && (
        <div className="profile-stats">
          <div>
            <strong>{data.stats.solved}</strong>
            <span>해결한 문제</span>
          </div>
          <div>
            <strong>{data.training.streak}</strong>
            <span>연속 연습일</span>
          </div>
          <div>
            <strong>{data.training.independentSolved}</strong>
            <span>도움 없이 해결</span>
          </div>
        </div>
      )}
      {error && (
        <Status className="inline-error" role="alert">
          {error}{" "}
          {!data && (
            <Button
              className="text-button"
              onClick={() => {
                setError("");
                setRetry(retry + 1);
              }}
            >
              다시 불러오기
            </Button>
          )}
        </Status>
      )}
      {params.has("error") && (
        <Status className="inline-warning" role="alert">
          계정을 연결하지 못했습니다. 프로필과 같은 이메일의 계정인지, 다른 CODE:FIT 계정에 이미
          연결되어 있는지 확인해 주세요.
        </Status>
      )}
      <div className="profile-grid">
        <Card as="section" className="profile-panel">
          <h2>내 프로필</h2>
          <form onSubmit={save}>
            <FieldLabel>
              이름
              <Input
                required
                minLength={2}
                maxLength={40}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                autoComplete="name"
              />
            </FieldLabel>
            <FieldLabel>
              한 줄 소개
              <Textarea
                aria-label="한 줄 소개"
                aria-describedby="profile-bio-count"
                maxLength={300}
                rows={4}
                value={bio}
                onChange={(e) => {
                  setBio(e.target.value);
                  setSaved(false);
                }}
                placeholder="관심 있는 기술이나 학습 목표를 적어 주세요."
              />
              <small id="profile-bio-count">{bio.length}/300</small>
            </FieldLabel>
            <Button className="primary-button" disabled={busy || name.trim().length < 2}>
              {busy ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}프로필 저장
            </Button>
            {saved && (
              <Status className="profile-saved" role="status">
                <Check size={16} />
                프로필을 저장했습니다.
              </Status>
            )}
          </form>
        </Card>
        <Card as="section" className="profile-panel">
          <h2>연결된 계정</h2>
          <p className="muted">
            같은 이메일의 Google, GitHub 계정을 연결하면 어느 쪽으로 로그인해도 같은 기록과 생성
            한도를 사용합니다.
          </p>
          {data ? (
            <ProviderButtons
              providers={providers}
              linked={data.linkedProviders}
              returnTo="/profile"
            />
          ) : (
            <Status role="status">연결된 계정 확인 중…</Status>
          )}
          <p className="muted">
            로그인 전 코딩 기록을 옮기려면 게스트 상태에서 환경 설정의 백업을 내보낸 뒤, 로그인하고
            가져오세요. 입문 실습 기록은 각 미션에서 별도로 내려받을 수 있으며 계정으로 옮기는
            기능은 지원하지 않습니다.
          </p>
        </Card>
      </div>
      <AiUsage />
      <div className="profile-signout">
        <Button className="secondary-button" disabled={busy} onClick={() => void signOut(false)}>
          <LogOut size={16} />
          로그아웃
        </Button>
        <Button className="text-button" disabled={busy} onClick={() => void signOut(true)}>
          모든 기기에서 로그아웃
        </Button>
      </div>
    </div>
  );
}
