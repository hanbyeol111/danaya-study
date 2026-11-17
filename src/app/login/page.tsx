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
        const res = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? "가입에 실패했어요");
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
    <form onSubmit={submit} className="mx-auto flex w-full max-w-md flex-col gap-3 p-6 pt-20">
      <h1 className="text-3xl font-extrabold text-accent">단아야 공부하자</h1>
      <p className="mb-4 text-muted">둘이 같이, 매일 토익 단어</p>
      <input className="input" type="email" autoComplete="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input
        className="input" type="password" placeholder="비밀번호 (8자 이상)" value={password}
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        onChange={(e) => setPassword(e.target.value)} required minLength={mode === "signup" ? 8 : undefined}
      />
      {err && <p className="text-sm text-bad">{err}</p>}
      <button className="btn-primary" disabled={busy}>{mode === "login" ? "로그인" : "가입하기"}</button>
      <button type="button" className="text-sm text-muted underline" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(""); }}>
        {mode === "login" ? "처음이에요 → 가입하기" : "이미 가입했어요 → 로그인"}
      </button>
    </form>
  );
}
