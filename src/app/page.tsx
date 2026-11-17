"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useMe } from "@/components/Shell";
import { Bar, Check, LateBadge, useUI } from "@/components/ui";
import { loadToday, markComplete, type UserDay } from "@/lib/day";
import { daysBetween } from "@/lib/rules";
import { supabase, must } from "@/lib/supabase";
import { dayLabel, pctOf } from "@/lib/browser";

type Unit = { id: string; user_id: string; title: string; scheduled_date: string; done: boolean; done_date: string | null; book_plans: { book_title: string } | null };
type Cheer = { message: string; from_user: string };
type Home = Awaited<ReturnType<typeof loadToday>> & { examDate: string; units: Unit[]; cheers: Cheer[]; myPlanCount: number };

const NAMES = { en2ko: "뜻 맞히기", ko2en: "영어 맞히기", review: "복습" } as const;

export default function HomePage() {
  const me = useMe();
  const [d, setD] = useState<Home | null>(null);
  const [err, setErr] = useState("");
  const [sheet, setSheet] = useState<string | null>(null); // 응원 시트 (초기 문구)

  const load = useCallback(async () => {
    try {
      const day = await loadToday();
      const today = day.today;
      const mine = day.users.find((u) => u.profile.id === me.id);
      if (mine && mine.progress.ratio >= 1) await markComplete(me.id, today);
      const [settings, units, cheers, plans] = await Promise.all([
        supabase.from("settings").select("exam_date").eq("id", 1).single().then(must),
        supabase.from("book_units").select("id,user_id,title,scheduled_date,done,done_date,book_plans(book_title)")
          .lte("scheduled_date", today).or(`done.eq.false,done_date.eq.${today}`).order("scheduled_date").order("position").then(must),
        supabase.from("cheers").select("message,from_user").order("created_at", { ascending: false }).limit(30).then(must),
        supabase.from("book_plans").select("id", { count: "exact", head: true }).eq("user_id", me.id),
      ]);
      setD({ ...day, examDate: settings!.exam_date, units: units as unknown as Unit[], cheers: cheers as Cheer[], myPlanCount: plans.count ?? 0 });
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [me.id]);

  useEffect(() => {
    load();
    // 퀴즈 결과의 "알리기"에서 넘어오면 응원 시트를 연다
    const pre = new URLSearchParams(window.location.search).get("cheer");
    if (pre !== null) {
      setSheet(pre);
      window.history.replaceState(null, "", "/");
    }
    const onFocus = () => document.visibilityState === "visible" && load();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  if (err) return <p className="p-4 text-bad-ink">불러오지 못했어요: {err}</p>;
  if (!d) return <p className="p-8 text-center text-l3">불러오는 중…</p>;

  const mine = d.users.find((u) => u.profile.id === me.id)!;
  const pt = d.users.find((u) => u.profile.id !== me.id);
  const ptName = pt?.profile.name ?? "상대";
  const dday = daysBetween(d.today, d.examDate);
  const hasSet = !!d.setId;
  const p = mine.progress;
  const next = !hasSet ? null : p.en2ko < p.n ? "en2ko" : p.ko2en < p.n ? "ko2en" : p.reviewDone < p.reviewTotal ? "review" : null;
  const remain = next === "en2ko" ? p.n - p.en2ko : next === "ko2en" ? p.n - p.ko2en : p.reviewTotal - p.reviewDone;
  const ptCheer = pt && d.cheers.find((c) => c.from_user === pt.profile.id);
  const myCheer = d.cheers.find((c) => c.from_user === me.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-end gap-2">
            <Avatar name={ptName} cls="bg-pt-soft text-pt-ink" />
            {ptCheer
              ? <div className="max-w-[74%] rounded-[18px_18px_18px_6px] bg-card px-3.5 py-[9px] text-[15px] leading-[1.35]">{ptCheer.message}</div>
              : <div className="rounded-[18px_18px_18px_6px] bg-card px-3.5 py-[9px] text-[15px] text-l3">아직 응원이 없어요</div>}
          </div>
          <div className="flex items-end justify-end gap-2">
            {myCheer ? (
              <>
                <button onClick={() => setSheet("")} className="h-10 shrink-0 border-0 bg-transparent px-1 text-[13px] font-semibold text-accent">새 응원</button>
                <button onClick={() => setSheet("")} className="min-h-10 max-w-[62%] rounded-[18px_18px_6px_18px] border-0 bg-accent px-3.5 py-[9px] text-left text-[15px] leading-[1.35] text-white">{myCheer.message}</button>
              </>
            ) : (
              <button onClick={() => setSheet("")} className="min-h-10 rounded-[18px_18px_6px_18px] bg-transparent px-3.5 py-2 text-[15px] font-semibold text-accent" style={{ border: "1.5px dashed var(--color-accent)" }}>
                {ptName}에게 응원 남기기
              </button>
            )}
            <Avatar name={me.name} cls="bg-me-soft text-me" />
          </div>
        </div>
        <div className="mt-1.5 flex min-h-11 items-center justify-between">
          <div className="text-[34px] font-bold leading-[41px] tracking-[0.01em]">토익까지 <span className="tnum">{dday > 0 ? `D-${dday}` : dday === 0 ? "D-DAY" : `D+${-dday}`}</span></div>
          <Link href="/settings" className="flex h-11 items-center pl-4 text-[17px] text-accent">설정</Link>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between px-1">
          <div className="text-lg font-bold">오늘의 분량</div>
          <div className="text-[13px] text-l2">{dayLabel(d.today)}{hasSet && ` · ${d.words.length}단어`}</div>
        </div>
        <div className="card overflow-hidden">
          <Row u={mine} isMe hasSet={hasSet} />
          {pt && <div className="ml-4 h-[0.5px] bg-sep" />}
          {pt && <Row u={pt} isMe={false} hasSet={hasSet} />}
        </div>
        {!hasSet ? (
          <Link href="/words/new" className="mt-0.5 flex h-[50px] items-center justify-center rounded-[14px] bg-accent text-[17px] font-semibold text-white">오늘 단어장 사진 올리기</Link>
        ) : next ? (
          <Link href="/quiz" className="mt-0.5 flex h-[50px] items-center justify-center gap-2 rounded-[14px] bg-accent text-white">
            <span className="text-[17px] font-semibold">이어서 하기</span>
            <span className="text-[13px] text-white/80">다음: {NAMES[next]} · {remain}개 남음</span>
          </Link>
        ) : (
          <div className="mt-0.5 flex h-[50px] items-center gap-2 rounded-[14px] bg-good-bg pl-4 pr-1.5">
            <span className="flex-1 text-[17px] font-semibold text-good-ink">오늘 분량 끝!</span>
            <Link href="/quiz?retry=1" className="flex h-[38px] items-center rounded-[10px] bg-card px-3.5 text-[15px] font-semibold text-accent">다시 풀어보기</Link>
          </div>
        )}
      </section>

      <BookToday d={d} meId={me.id} meName={me.name} pt={pt} reload={load} />

      {sheet !== null && (
        <CheerSheet
          ptName={ptName} initial={sheet} onClose={() => setSheet(null)}
          onSent={() => { setSheet(null); load(); }}
        />
      )}
    </div>
  );
}

function Avatar({ name, cls }: { name: string; cls: string }) {
  return <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${cls}`}>{name.slice(0, 1)}</span>;
}

function Row({ u, isMe, hasSet }: { u: UserDay; isMe: boolean; hasSet: boolean }) {
  const p = u.progress;
  const pct = pctOf(p.ratio);
  const f = (c: number, t: number) => (t > 0 && c >= t ? "✓" : c > 0 ? `${c}/${t}` : "–");
  const steps = [`뜻 ${f(p.en2ko, p.n)}`, `영어 ${f(p.ko2en, p.n)}`, `복습 ${p.reviewTotal === 0 ? "없음" : f(p.reviewDone, p.reviewTotal)}`];
  const note = !hasSet ? "단어장 대기 중" : !isMe && pct === 0 ? "아직 시작 안 했어요" : !isMe && pct === 100 ? "오늘 끝냈어요" : null;
  return (
    <div className="flex flex-col gap-2 px-4 py-3.5">
      <div className="flex items-center gap-2">
        <span className={`text-[17px] font-semibold ${isMe ? "text-me" : "text-pt-ink"}`}>{u.profile.name}</span>
        {isMe && <span className="text-[13px] text-l3">나</span>}
        <span className="flex-1" />
        <span className="tnum text-xl font-semibold">{pct}%</span>
      </div>
      <Bar pct={pct} color={isMe ? "bg-me" : "bg-pt"} />
      {note ? <div className="text-sm text-l2">{note}</div> : (
        <div className="tnum flex gap-3.5 text-sm text-l2">{steps.map((s) => <span key={s}>{s}</span>)}</div>
      )}
    </div>
  );
}

function BookToday({ d, meId, meName, pt, reload }: { d: Home; meId: string; meName: string; pt?: UserDay; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const items = (uid: string) =>
    d.units.filter((x) => x.user_id === uid)
      .map((x) => ({ ...x, late: !x.done && x.scheduled_date < d.today }))
      .sort((a, b) => Number(b.late) - Number(a.late) || a.scheduled_date.localeCompare(b.scheduled_date));
  const mine = items(meId);
  const theirs = pt ? items(pt.profile.id) : [];
  const label = (x: Unit) => (x.book_plans ? `${x.book_plans.book_title} · ${x.title}` : x.title);

  async function toggle(x: Unit) {
    await supabase.from("book_units").update({ done: !x.done, done_date: x.done ? null : d.today }).eq("id", x.id);
    reload();
  }
  async function add() {
    if (!title.trim()) return;
    await supabase.from("book_units").insert({ title: title.trim().slice(0, 40), scheduled_date: d.today });
    setTitle("");
    setOpen(false);
    reload();
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="px-1 text-lg font-bold">오늘의 책</div>
      <div className="card overflow-hidden">
        <div className="flex gap-2.5 pl-4 pr-3">
          <div className="w-9 shrink-0 text-sm font-semibold leading-[44px] text-me">{meName}</div>
          <div className="flex min-w-0 flex-1 flex-col">
            {mine.map((x) => (
              <button key={x.id} onClick={() => toggle(x)} className="flex min-h-11 items-center gap-2.5 border-0 bg-transparent p-0 text-left">
                <Check done={x.done} />
                <span className={`min-w-0 flex-1 truncate text-[15px] ${x.done ? "text-l3 line-through" : ""}`}>{label(x)}</span>
                {x.late && <LateBadge />}
              </button>
            ))}
            {!mine.length && d.myPlanCount > 0 && <div className="flex min-h-11 items-center text-[15px] text-l2">책 쉬는 날 (복습 추천)</div>}
            {!mine.length && d.myPlanCount === 0 && !open && (
              <button onClick={() => setOpen(true)} className="min-h-11 border-0 bg-transparent p-0 text-left text-[15px] text-accent">오늘 범위 직접 적기</button>
            )}
            {open && (
              <form className="flex gap-2 py-1.5" onSubmit={(e) => { e.preventDefault(); add(); }}>
                <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 40))} placeholder="예: LC p.80~95" autoFocus className="h-10 min-w-0 flex-1 rounded-[10px] border-0 bg-bg px-3 text-[15px] outline-none" />
                <button className="h-10 rounded-[10px] border-0 bg-accent px-3.5 text-[15px] font-semibold text-white">추가</button>
              </form>
            )}
          </div>
        </div>
        {pt && (
          <>
            <div className="ml-4 h-[0.5px] bg-sep" />
            <div className="flex gap-2.5 pl-4 pr-3">
              <div className="w-9 shrink-0 text-sm font-semibold leading-[44px] text-pt-ink">{pt.profile.name}</div>
              <div className="flex min-w-0 flex-1 flex-col">
                {theirs.map((x) => (
                  <div key={x.id} className="flex min-h-11 items-center gap-2.5">
                    <Check done={x.done} dim />
                    <span className={`min-w-0 flex-1 truncate text-[15px] ${x.done ? "text-l3 line-through" : ""}`}>{label(x)}</span>
                    {x.late && <LateBadge />}
                  </div>
                ))}
                {!theirs.length && <div className="flex min-h-11 items-center text-[15px] text-l3">책 계획 없음</div>}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

const PRESETS = ["오늘은 꼭 끝내자!", "나 먼저 끝냈다", "조금만 더 힘내!", "같이 하자, 지금 시작!"];

function CheerSheet({ ptName, initial, onClose, onSent }: { ptName: string; initial: string; onClose: () => void; onSent: () => void }) {
  const { toast } = useUI();
  const [msg, setMsg] = useState(initial);
  async function send() {
    const m = msg.trim();
    if (!m) return;
    const { error } = await supabase.from("cheers").insert({ message: m.slice(0, 60) });
    if (error) return toast(error.message);
    toast(`${ptName}에게 응원을 남겼어요`);
    onSent();
  }
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative mx-auto flex w-full max-w-md flex-col gap-3.5 rounded-t-3xl bg-card px-5 pb-[max(env(safe-area-inset-bottom),44px)] pt-[22px]">
        <div className="text-xl font-bold">{ptName}에게 응원 한 줄</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((t) => (
            <button key={t} onClick={() => setMsg(t)} className="h-[38px] rounded-full border border-g3 bg-bg px-3.5 text-sm text-l4">{t}</button>
          ))}
        </div>
        <div className="relative">
          <input value={msg} onChange={(e) => setMsg(e.target.value.slice(0, 60))} placeholder="직접 쓰기 (60자까지)" className="h-[54px] w-full rounded-xl border border-g3 pl-4 pr-16 text-base outline-none focus:border-accent" />
          <span className="tnum absolute right-3.5 top-[18px] text-[13px] text-l3">{msg.length}/60</span>
        </div>
        <button onClick={send} disabled={!msg.trim()} className="h-[54px] rounded-[14px] border-0 bg-accent text-base font-[650] text-white disabled:bg-g4">남기기</button>
      </div>
    </div>
  );
}
