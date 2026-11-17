"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (mode === "signup") {
        // 인증 메일은 꺼 두어서 가입하면 바로 로그인된다
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw new Error(/registered|exists/i.test(error.message) ? "이미 가입된 이메일이에요. 로그인해 주세요." : error.message);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error("이메일 또는 비밀번호가 맞지 않아요");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-9 px-7 pb-12 pt-[60px]">
      <div className="flex flex-col gap-3.5">
        <div className="flex size-[52px] items-center justify-center rounded-[14px] bg-accent text-[22px] font-bold text-bg">단</div>
        <div className="text-[28px] font-bold leading-tight">단아야 공부하자</div>
        <div className="text-base leading-normal text-l2">둘이 같이, 매일 토익</div>
      </div>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm text-l2">
          이메일
          <input className="field-lg" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} required />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-l2">
          비밀번호{mode === "signup" && " (8자 이상)"}
          <input
            className="field-lg" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
            autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "signup" ? 8 : undefined}
          />
        </label>
        {err && <div className="px-0.5 pt-0.5 text-sm text-bad-ink">{err}</div>}
      </div>
      <div className="flex flex-col gap-3.5">
        <button className="btn-primary" disabled={busy}>{mode === "login" ? "로그인" : "가입하기"}</button>
        <button type="button" className="border-0 bg-transparent text-[13px] text-l3" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(""); }}>
          {mode === "login" ? "처음이에요 · 가입하기" : "이미 가입했어요 · 로그인"}
        </button>
      </div>
    </form>
  );
}
