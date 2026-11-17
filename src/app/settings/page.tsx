"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useMe } from "@/components/Shell";
import { Segment, TopBar, useUI } from "@/components/ui";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const me = useMe();
  const router = useRouter();
  const { toast, ask } = useUI();
  const [name, setName] = useState(me.name);
  const [exam, setExam] = useState("");
  const [edition, setEdition] = useState<"8" | "9">("9");

  useEffect(() => {
    supabase.from("settings").select("exam_date,hackers_edition").eq("id", 1).single().then(({ data }) => {
      if (data) { setExam(data.exam_date); setEdition(String(data.hackers_edition) as "8" | "9"); }
    });
  }, []);

  async function save() {
    if (!name.trim() || !exam) return;
    const [a, b] = await Promise.all([
      supabase.from("profiles").update({ name: name.trim() }).eq("id", me.id),
      supabase.from("settings").update({ exam_date: exam, hackers_edition: Number(edition) }).eq("id", 1),
    ]);
    const err = a.error ?? b.error;
    if (err) return toast(err.message);
    me.setName?.(name.trim());
    toast("저장했어요");
    router.push("/");
  }

  return (
    <div className="flex min-h-[calc(100dvh-60px)] flex-col gap-5">
      <TopBar back="홈" href="/" />
      <div className="text-[26px] font-bold">설정</div>
      <div className="rounded-[18px] bg-card px-4 py-1">
        <label className="flex min-h-[60px] items-center gap-3 border-b border-bg text-base">
          <span className="flex-1">표시 이름</span>
          <input value={name} maxLength={10} onChange={(e) => setName(e.target.value)} className="h-10 w-[150px] rounded-[10px] border border-g3 px-3 text-right text-base outline-none focus:border-accent" />
        </label>
        <label className="flex min-h-[60px] items-center gap-3 text-base">
          <span className="flex-1">시험일</span>
          <input type="date" value={exam} onChange={(e) => setExam(e.target.value)} className="h-10 w-[170px] rounded-[10px] border border-g3 bg-card px-2.5 text-[15px] outline-none focus:border-accent" />
        </label>
      </div>
      <div className="flex flex-col gap-2">
        <div className="px-1 text-sm font-semibold text-l2">해커스 토익 기본서 판 <span className="font-normal text-l3">· 책 판권면에서 확인 (둘이 같이 씀)</span></div>
        <Segment value={edition} options={[["9", "9판 (2023)"], ["8", "8판"]]} onChange={setEdition} />
      </div>
      <button className="btn-primary h-[54px] text-base" disabled={!name.trim() || !exam} onClick={save}>저장</button>
      <Link href="/help" className="btn-secondary">도움말 · 앱 사용법</Link>
      <div className="flex-1" />
      <button
        onClick={async () => { if (await ask("로그아웃할까요?", "다시 들어오려면 이메일과 비밀번호가 필요해요.", "로그아웃")) supabase.auth.signOut(); }}
        className="h-[50px] border-0 bg-transparent text-base font-semibold text-bad-ink"
      >로그아웃</button>
    </div>
  );
}
