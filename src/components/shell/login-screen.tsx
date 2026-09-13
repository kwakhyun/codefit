"use client";
import type { Dispatch, SetStateAction } from "react";

import { ArrowRight, LoaderCircle, Terminal } from "lucide-react";
import { type FormEvent } from "react";
interface LoginScreenProps {
  login: (e: FormEvent) => Promise<void>;
  password: string;
  setPassword: Dispatch<SetStateAction<string>>;
  loadError: string;
  loginBusy: boolean;
}
export function LoginScreen({
  login,
  password,
  setPassword,
  loadError,
  loginBusy,
}: LoginScreenProps) {
  return (
    <main className="login-page">
      <form onSubmit={login}>
        <div className="brand-logo">
          <Terminal size={26} />
          <span>
            CODE:FIT<span className="brand-cursor">_</span>
          </span>
        </div>
        <span className="eyebrow">YOUR DAILY CODING GYM</span>
        <h1>오늘도, 코딩 근력을 지킬 시간.</h1>
        <p>연습실 접근 암호를 입력해 주세요.</p>
        <label>
          접근 암호
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </label>
        {loadError && (
          <p className="inline-error" role="alert">
            {loadError}
          </p>
        )}
        <button className="primary-button full-width" disabled={loginBusy}>
          {loginBusy ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />}
          연습실 열기
        </button>
      </form>
    </main>
  );
}
