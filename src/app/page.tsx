"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useMe } from "@/components/Shell";
import { loadToday, markComplete, type UserDay } from "@/lib/day";
import { daysBetween, intersect, streak } from "@/lib/rules";
import { supabase, must } from "@/lib/supabase";
import { fmtDate } from "@/lib/browser";

type Unit = { id: string; user_id: string; title: string; scheduled_date: string; done: boolean; done_date: string | null; book_plans: { book_title: string } | null };
type Home = Awaited<ReturnType<typeof loadToday>> & {
  examDate: string;
  bothStreak: number;
  units: Unit[];
  cheer: { message: string; from_user: string } | null;
};

export default function HomePage() {
  const me = useMe();
  const [d, setD] = useState<Home | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const day = await loadToday();
      const today = day.today;
      const mine = day.users.find((u) => u.profile.id === me.id);
      if (mine && mine.progress.ratio >= 1) await markComplete(me.id, today);
      const [settings, comps, units, cheer] = await Promise.all([
        supabase.from("settings").select("exam_date").eq("id", 1).single().then(must),
        supabase.from("completions").select("user_id,study_date").gte("study_date", "2020-01-01").then(must),
        supabase.from("book_units").select("id,user_id,title,scheduled_date,done,done_date,book_plans(book_title)")
          .lte("scheduled_date", today).or(`done.eq.false,done_date.eq.${today}`).order("scheduled_date").order("position").then(must),
        supabase.from("cheers").select("message,from_user").order("created_at", { ascending: false }).limit(1).maybeSingle().then(must),
      ]);
      const byUser = (id: string) => new Set((comps as { user_id: string; study_date: string }[]).filter((c) => c.user_id === id).map((c) => c.study_date));
      const ids = day.users.map((u) => u.profile.id);
      const both = ids.length === 2 ? streak(intersect(byUser(ids[0]), byUser(ids[1])), today) : 0;
      setD({ ...day, examDate: settings!.exam_date, bothStreak: both, units: units as unknown as Unit[], cheer });
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [me.id]);

  useEffect(() => {
    load();
    const onFocus = () => document.visibilityState === "visible" && load();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  if (err) return <p className="p-4 text-bad">불러오지 못했어요: {err}</p>;
  if (!d) return <p className="p-8 text-center text-muted">불러오는 중…</p>;

  const users = [...d.users.filter((u) => u.profile.id === me.id), ...d.users.filter((u) => u.profile.id !== me.id)];
  const mine = users.find((u) => u.profile.id === me.id);
  const dday = daysBetween(d.today, d.examDate);
  const nameOf = (id: string) => d.users.find((u) => u.profile.id === id)?.profile.name ?? "";

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-extrabold">토익까지 {dday > 0 ? `D-${dday}` : dday === 0 ? "D-DAY" : `D+${-dday}`}</p>
          <p className="mt-1 text-lg font-bold text-accent">🔥 둘 다 {d.bothStreak}일 연속</p>
        </div>
        <Link href="/settings" aria-label="설정" className="p-2 text-2xl">⚙️</Link>
      </header>

      <section>
        <p className="mb-2 text-sm text-muted">
          오늘의 분량 · {fmtDate(d.today)} {d.setId ? `(단어 ${d.words.length}개)` : ""}
        </p>
        <div className="card flex flex-col divide-y divide-line p-0">
          {users.map((u) => <UserRow key={u.profile.id} u={u} isMe={u.profile.id === me.id} hasSet={!!d.setId} />)}
        </div>
      </section>

      {!d.setId ? (
        <Link href="/words/new" className="btn-primary text-center">📷 오늘 단어장 사진 올리기</Link>
      ) : mine && mine.progress.ratio >= 1 ? (
        <div className="flex flex-col gap-2">
          <p className="text-center text-lg font-bold text-good">🎉 오늘 분량 끝!</p>
          <Link href="/quiz?retry=1" className="btn text-center">다시 풀어보기</Link>
        </div>
      ) : (
        <Link href="/quiz" className="btn-primary text-center">이어서 하기</Link>
      )}

      <BookToday units={d.units} users={users} meId={me.id} today={d.today} reload={load} />

      <Cheer cheer={d.cheer} name={d.cheer ? nameOf(d.cheer.from_user) : ""} reload={load} />
    </div>
  );
}

function UserRow({ u, isMe, hasSet }: { u: UserDay; isMe: boolean; hasSet: boolean }) {
  const p = u.progress;
  const pct = Math.round(p.ratio * 100);
  const step = (done: number, total: number) => (total === 0 ? "없음" : done >= total ? "✓" : done > 0 ? `${done}/${total}` : "–");
  const color = isMe ? "bg-accent" : "bg-partner";
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-3">
        <span className="w-12 shrink-0 font-bold">{u.profile.name}</span>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-line">
          <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-11 shrink-0 text-right font-bold">{pct}%</span>
      </div>
      <p className="text-sm text-muted">
        {!hasSet ? "단어장 대기 중"
          : !isMe && pct === 0 ? "아직 시작 안 했어요"
          : !isMe && pct === 100 ? "오늘 끝냈어요 ✓"
          : `뜻 ${step(p.en2ko, p.n)}  ·  영어 ${step(p.ko2en, p.n)}  ·  복습 ${step(p.reviewDone, p.reviewTotal)}`}
      </p>
    </div>
  );
}

function BookToday({ units, users, meId, today, reload }: { units: Unit[]; users: UserDay[]; meId: string; today: string; reload: () => void }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  async function toggle(u: Unit) {
    await supabase.from("book_units").update({ done: !u.done, done_date: u.done ? null : today }).eq("id", u.id);
    reload();
  }
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-muted">오늘의 책</p>
        <button className="text-sm text-accent" onClick={() => setAdding(!adding)}>+ 직접 적기</button>
      </div>
      {adding && (
        <form
          className="mb-2 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            await supabase.from("book_units").insert({ title: title.trim(), scheduled_date: today });
            setTitle("");
            setAdding(false);
            reload();
          }}
        >
          <input className="input" maxLength={40} placeholder="예: LC p.80~95" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <button className="btn shrink-0">추가</button>
        </form>
      )}
      <div className="card flex flex-col gap-3">
        {users.map((u) => {
          const mine = units.filter((x) => x.user_id === u.profile.id);
          const isMe = u.profile.id === meId;
          return (
            <div key={u.profile.id} className="flex gap-3">
              <span className="w-12 shrink-0 font-bold">{u.profile.name}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {mine.length === 0 && <span className="text-sm text-muted">{isMe ? "오늘 책 할 일이 없어요" : "책 계획 없음"}</span>}
                {mine.map((x) => (
                  <label key={x.id} className={`flex items-start gap-2 text-sm ${isMe ? "cursor-pointer" : ""}`}>
                    <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" checked={x.done} disabled={!isMe} onChange={() => toggle(x)} />
                    <span className={x.done ? "text-muted line-through" : ""}>
                      {x.book_plans ? `${x.book_plans.book_title} · ` : ""}{x.title}
                      {!x.done && x.scheduled_date < today && <span className="ml-1 text-bad">(밀림)</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Cheer({ cheer, name, reload }: { cheer: Home["cheer"]; name: string; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-sm">{cheer ? <><b>{name}</b>: “{cheer.message}”</> : <span className="text-muted">아직 응원이 없어요</span>}</p>
        <button className="btn shrink-0" onClick={() => setOpen(!open)}>응원 남기기</button>
      </div>
      {open && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!msg.trim()) return;
            await supabase.from("cheers").insert({ message: msg.trim() });
            setMsg("");
            setOpen(false);
            reload();
          }}
        >
          <input className="input" maxLength={60} placeholder="한 줄 응원 (60자)" value={msg} onChange={(e) => setMsg(e.target.value)} autoFocus />
          <button className="btn shrink-0">보내기</button>
        </form>
      )}
    </section>
  );
}
