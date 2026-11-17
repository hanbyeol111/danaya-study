"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMe } from "@/components/Shell";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const me = useMe();
  const [name, setName] = useState(me.name);
  const [exam, setExam] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.from("settings").select("exam_date").eq("id", 1).single().then(({ data }) => data && setExam(data.exam_date));
  }, []);

  async function save() {
    const [a, b] = await Promise.all([
      supabase.from("profiles").update({ name: name.trim() }).eq("id", me.id),
      supabase.from("settings").update({ exam_date: exam }).eq("id", 1),
    ]);
    const err = a.error ?? b.error;
    if (err) return setMsg(err.message);
    me.setName?.(name.trim());
    setMsg("저장했어요");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/" className="text-muted" aria-label="뒤로">←</Link>
        <h1 className="h1">설정</h1>
      </div>
      <label className="text-sm text-muted">표시 이름<input className="input mt-1" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="text-sm text-muted">시험일 (두 사람 공통)<input type="date" className="input mt-1" value={exam} onChange={(e) => setExam(e.target.value)} /></label>
      <button className="btn-primary" disabled={!name.trim() || !exam} onClick={save}>저장</button>
      {msg && <p className="text-center text-sm">{msg}</p>}
      <button className="btn mt-6" onClick={() => supabase.auth.signOut()}>로그아웃</button>
    </div>
  );
}
