"use client";
import type { Dispatch, SetStateAction } from "react";

import { Modal } from "@/components/ui/modal";
import { type FormEvent } from "react";
interface SessionDialogProps {
  reauth: boolean;
  login: (e: FormEvent) => Promise<void>;
  password: string;
  setPassword: Dispatch<SetStateAction<string>>;
  loadError: string;
  loginBusy: boolean;
}
export function SessionDialog({
  reauth,
  login,
  password,
  setPassword,
  loadError,
  loginBusy,
}: SessionDialogProps) {
  return (
    <Modal open={reauth} onClose={() => {}} title="연습실 다시 연결" dismissible={false}>
      <form className="settings-content" onSubmit={login}>
        <h2>접근 암호를 다시 입력해 주세요.</h2>
        <p className="muted">
          로그인 시간이 만료되었습니다. 작성 중인 코드는 유지되며 연결 후 저장을 다시 시도합니다.
        </p>
        <label className="reauth-field">
          접근 암호
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {loadError && (
          <p className="inline-error" role="alert">
            {loadError}
          </p>
        )}
        <button className="primary-button full-width" disabled={loginBusy}>
          {loginBusy ? "연결 중…" : "다시 연결"}
        </button>
      </form>
    </Modal>
  );
}
