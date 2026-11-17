"use client";

import { useEffect, useState } from "react";
import { useMe } from "@/components/Shell";
import { supabase, must } from "@/lib/supabase";
import { intersect, streak, todayKST } from "@/lib/rules";

type Profile = { id: string; name: string };
type Stat = { profile: Profile; done: Set<string>; learned: number; accuracy: number | null };

export default function HistoryPage() {
  const me = useMe();
  const today = todayKST();
  const [month, setMonth] = useState(today.slice(0, 7)); // YYYY-MM
  const [stats, setStats] = useState<Stat[] | null>(null);

  useEffect(() => {
    (async () => {
      const [profiles, comps, att] = await Promise.all([
        supabase.from("profiles").select("id,name").order("created_at").then(must),
        supabase.from("completions").select("user_id,study_date").then(must),
        // shortcut: 시도 기록을 전부 가져와 집계. 수만 건이 넘으면 SQL 집계 뷰로 바꾼다
        supabase.from("attempts").select("user_id,word_id,mode,correct").range(0, 99999).then(must),
      ]);
      const s = (profiles as Profile[]).map((p) => {
        const mine = (att as { user_id: string; word_id: string; mode: string; correct: boolean }[]).filter((a) => a.user_id === p.id);
        return {
          profile: p,
          done: new Set((comps as { user_id: string; study_date: string }[]).filter((c) => c.user_id === p.id).map((c) => c.study_date)),
          learned: new Set(mine.filter((a) => a.mode === "ko2en" && a.correct).map((a) => a.word_id)).size,
          accuracy: mine.length ? Math.round((mine.filter((a) => a.correct).length / mine.length) * 100) : null,
        };
      });
      setStats([...s.filter((x) => x.profile.id === me.id), ...s.filter((x) => x.profile.id !== me.id)]);
    })();
  }, [me.id]);

  if (!stats) return <p className="p-8 text-center text-muted">불러오는 중…</p>;

  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const shift = (d: number) => {
    const dt = new Date(Date.UTC(y, m - 1 + d, 1));
    setMonth(dt.toISOString().slice(0, 7));
  };
  const both = stats.length === 2 ? streak(intersect(stats[0].done, stats[1].done), today) : 0;
  const colors = ["bg-accent border-accent", "bg-partner border-partner"];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">기록</h1>
      <div className="card text-center">
        <p className="text-sm text-muted">둘 다 연속</p>
        <p className="text-3xl font-extrabold text-accent">🔥 {both}일</p>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <button className="btn" onClick={() => shift(-1)} aria-label="이전 달">◀</button>
          <span className="font-bold">{y}년 {m}월</span>
          <button className="btn" onClick={() => shift(1)} aria-label="다음 달">▶</button>
        </div>
        <div className="grid grid-cols-7 gap-y-2 text-center text-xs">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => <span key={d} className="text-muted">{d}</span>)}
          {Array.from({ length: first }, (_, i) => <span key={"b" + i} />)}
          {Array.from({ length: days }, (_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, "0")}`;
            return (
              <div key={date} className={`flex flex-col items-center gap-1 ${date === today ? "font-bold text-accent" : ""}`}>
                <span>{i + 1}</span>
                <span className="flex gap-0.5">
                  {stats.map((s, k) => (
                    <span key={s.profile.id} className={`size-2 rounded-full border ${s.done.has(date) ? colors[k] : "border-line"}`} />
                  ))}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex justify-center gap-4 text-xs text-muted">
          {stats.map((s, k) => (
            <span key={s.profile.id} className="flex items-center gap-1"><span className={`size-2 rounded-full border ${colors[k]}`} />{s.profile.name}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.profile.id} className="card flex flex-col gap-1">
            <p className="font-bold">{s.profile.name}</p>
            <p className="text-sm">연속 <b>{streak(s.done, today)}일</b></p>
            <p className="text-sm">외운 단어 <b>{s.learned}개</b></p>
            <p className="text-sm">정답률 <b>{s.accuracy === null ? "–" : `${s.accuracy}%`}</b></p>
          </div>
        ))}
      </div>
    </div>
  );
}
