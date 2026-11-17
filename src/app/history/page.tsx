"use client";

import { useEffect, useState } from "react";
import { TOURS } from "@/lib/tours";
import Tour from "@/components/Tour";
import Link from "next/link";
import { useMe } from "@/components/Shell";
import { useUI } from "@/components/ui";
import { supabase, must } from "@/lib/supabase";
import { intersect, streak, todayKST } from "@/lib/rules";

type Profile = { id: string; name: string };
type Stat = { profile: Profile; done: Set<string>; learned: number; accuracy: number | null };

export default function HistoryPage() {
  const me = useMe();
  const today = todayKST();
  const thisMonth = today.slice(0, 7);
  const [month, setMonth] = useState(thisMonth); // YYYY-MM
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

  if (!stats) return <p className="p-8 text-center text-l3">불러오는 중…</p>;

  const [mine, pt] = stats;
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const earliest = [...stats.flatMap((s) => [...s.done]), today].sort()[0].slice(0, 7);
  const canPrev = month > earliest;
  const canNext = month < thisMonth;
  const shift = (d: number) => setMonth(new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 7));
  const both = pt ? streak(intersect(mine.done, pt.done), today) : 0;
  const dot = (on: boolean, fut: boolean, color: string) => (
    <span className="size-[7px] rounded-full" style={{ border: `1.5px solid ${fut ? "transparent" : color}`, background: on ? color : "transparent" }} />
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="pt-1.5 text-[26px] font-bold">기록</div>
      <div data-tour="calendar" className="flex flex-col gap-2.5 rounded-[18px] bg-card px-3 pb-4 pt-3.5">
        <div className="flex items-center justify-between px-0.5">
          <button onClick={() => canPrev && shift(-1)} aria-label="이전 달" className={`size-11 border-0 bg-transparent text-xl ${canPrev ? "text-accent" : "text-g4"}`}>‹</button>
          <div className="text-[17px] font-bold">{y}년 {m}월</div>
          <button onClick={() => canNext && shift(1)} aria-label="다음 달" className={`size-11 border-0 bg-transparent text-xl ${canNext ? "text-accent" : "text-g4"}`}>›</button>
        </div>
        <div className="grid grid-cols-7 text-center text-xs font-semibold text-l3">{["일", "월", "화", "수", "목", "금", "토"].map((d) => <span key={d}>{d}</span>)}</div>
        <div className="grid grid-cols-7 gap-y-1.5">
          {Array.from({ length: first }, (_, i) => <span key={"b" + i} />)}
          {Array.from({ length: days }, (_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, "0")}`;
            const fut = date > today, isT = date === today;
            return (
              <div key={date} className="flex h-[52px] flex-col items-center justify-center gap-[5px]">
                <span className={`tnum flex size-7 items-center justify-center rounded-full text-sm ${isT ? "bg-accent font-bold text-white" : fut ? "font-medium text-g4" : "font-medium"}`}>{i + 1}</span>
                <span className="flex h-[7px] gap-1">
                  {dot(mine.done.has(date), fut, "#5856d6")}
                  {pt && dot(pt.done.has(date), fut, "#ff2d55")}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center gap-4 pt-1 text-[13px] text-l2">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-me" />{mine.profile.name}</span>
          {pt && <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-pt" />{pt.profile.name}</span>}
          <span>빈 점 = 못 끝낸 날</span>
        </div>
      </div>

      <div data-tour="streak" className="flex items-center justify-between rounded-[18px] bg-accent p-[18px] text-white">
        <span className="text-[15px] text-white/75">둘 다 연속</span>
        <span className="tnum text-[28px] font-bold">{both}일</span>
      </div>

      <div data-tour="stats" className="rounded-[18px] bg-card px-4 py-1.5">
        <div className="grid min-h-11 grid-cols-[minmax(0,1.2fr)_1fr_1fr] items-center border-b border-bg text-sm font-bold">
          <span />
          <span className="text-right text-me">{mine.profile.name}</span>
          <span className="text-right text-pt-ink">{pt?.profile.name ?? ""}</span>
        </div>
        {[
          ["개인 연속", (s: Stat) => `${streak(s.done, today)}일`],
          ["외운 단어", (s: Stat) => `${s.learned}개`],
          ["정답률", (s: Stat) => (s.accuracy === null ? "–" : `${s.accuracy}%`)],
        ].map(([label, f]) => (
          <div key={label as string} className="tnum grid min-h-[52px] grid-cols-[minmax(0,1.2fr)_1fr_1fr] items-center border-b border-bg text-[15px] last:border-0">
            <span className="text-l2">{label as string}</span>
            <span className="text-right font-bold">{(f as (s: Stat) => string)(mine)}</span>
            <span className="text-right font-bold">{pt ? (f as (s: Stat) => string)(pt) : ""}</span>
          </div>
        ))}
      </div>

      <Account name={mine.profile.name} />
      <Tour id="history" steps={TOURS.history} />
    </div>
  );
}

function Account({ name }: { name: string }) {
  const { ask } = useUI();
  const [email, setEmail] = useState("");
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? ""));
  }, []);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="px-1 text-[17px] font-bold">계정</div>
      <div className="rounded-[18px] bg-card px-4 py-1">
        <div className="flex min-h-[52px] items-center gap-3 border-b border-bg text-[15px]">
          <span className="flex-1 text-l2">이름</span>
          <span className="font-semibold">{name}</span>
        </div>
        <div className="flex min-h-[52px] items-center gap-3 text-[15px]">
          <span className="shrink-0 text-l2">로그인 이메일</span>
          <span className="min-w-0 flex-1 truncate text-right font-semibold">{email}</span>
        </div>
      </div>
      <Link data-tour="help" href="/help" className="flex h-[50px] items-center justify-center rounded-[14px] bg-card text-base font-semibold text-accent">도움말 · 앱 사용법</Link>
      <button
        onClick={async () => { if (await ask("로그아웃할까요?", "다시 들어오려면 이메일과 비밀번호가 필요해요.", "로그아웃")) supabase.auth.signOut(); }}
        className="h-[50px] rounded-[14px] border-0 bg-card text-base font-semibold text-bad-ink"
      >로그아웃</button>
    </div>
  );
}
