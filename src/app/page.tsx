"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useMe } from "@/components/Shell";
import { Bar, Check, LateBadge, useUI } from "@/components/ui";
import { loadToday, markComplete, type UserDay } from "@/lib/day";
import { daysBetween } from "@/lib/rules";
import { supabase, must } from "@/lib/supabase";
import { dayLabel, pctOf } from "@/lib/browser";
import { resourcesFor, type Resource } from "@/lib/hackers";

type Unit = { id: string; user_id: string; plan_id: string | null; title: string; scheduled_date: string; done: boolean; done_date: string | null; book_plans: { book_title: string } | null };
type Cheer = { message: string; from_user: string };
type NextDay = { id: string; title: string; word_books: { title: string } | null };
type Home = Awaited<ReturnType<typeof loadToday>> & { examDate: string; edition: number; units: Unit[]; cheers: Cheer[]; myPlanCount: number; nextDay: NextDay | null; wordDay: { title: string; book: string } | null };

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
      const [settings, units, cheers, plans, nextDay, wordDay] = await Promise.all([
        supabase.from("settings").select("exam_date,hackers_edition").eq("id", 1).single().then(must),
        supabase.from("book_units").select("id,user_id,plan_id,title,scheduled_date,done,done_date,book_plans(book_title)")
          .lte("scheduled_date", today).or(`done.eq.false,done_date.eq.${today}`).order("scheduled_date").order("position").then(must),
        supabase.from("cheers").select("message,from_user").order("created_at", { ascending: false }).limit(30).then(must),
        supabase.from("book_plans").select("id", { count: "exact", head: true }).eq("user_id", me.id),
        // 오늘 분량이 없을 때 이어서 할 Day: 가장 최근에 공부한 단어장의 다음 Day
        day.setId ? null : nextDayOf(),
        // 오늘 단어 분량이 어느 단어장의 어느 Day인지 (해커스 단어암기 MP3 고르기용)
        day.setId ? supabase.from("word_sets").select("title,study_date,word_books(title)").eq("id", day.setId).single().then(({ data }) => data && {
          title: data.title || "오늘 단어", book: (data.word_books as unknown as { title: string } | null)?.title ?? "",
        }) : null,
      ]);
      setD({
        ...day, examDate: settings!.exam_date, edition: settings!.hackers_edition, units: units as unknown as Unit[],
        cheers: cheers as Cheer[], myPlanCount: plans.count ?? 0, nextDay, wordDay: wordDay ?? null,
      });
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

      {dday >= 0 && dday <= 7 && (
        <Link href="/book/guide#exam" className="flex items-center gap-3 rounded-2xl bg-pt-soft px-4 py-3">
          <span className="min-w-0 flex-1 text-[15px] leading-snug"><b className="text-pt-ink">시험 준비물·시간표</b><br /><span className="text-l4">신분증부터 챙겨요 · 오전 9:30 오리엔테이션 시작</span></span>
          <span className="text-xl text-pt-ink">›</span>
        </Link>
      )}

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
        {!hasSet && d.nextDay ? (
          <div className="mt-0.5 flex flex-col gap-1">
            <button
              onClick={async () => { await supabase.from("word_sets").update({ study_date: d.today }).eq("id", d.nextDay!.id); load(); }}
              className="flex h-[50px] items-center justify-center gap-2 rounded-[14px] border-0 bg-accent text-white"
            >
              <span className="text-[17px] font-semibold">{d.nextDay.title} 시작하기</span>
              <span className="text-[13px] text-white/80">{d.nextDay.word_books?.title}</span>
            </button>
            <Link href="/words/new" className="btn-text">다른 단어 사진 올리기</Link>
          </div>
        ) : !hasSet ? (
          <Link href="/words/new" className="mt-0.5 flex h-[50px] items-center justify-center rounded-[14px] bg-accent text-[17px] font-semibold text-white">오늘 단어장 사진 올리기</Link>
        ) : next ? (
          <Link href="/quiz" className="mt-0.5 flex h-[50px] items-center justify-center gap-2 rounded-[14px] bg-accent text-white">
            <span className="text-[17px] font-semibold">이어서 하기</span>
            <span className="text-[13px] text-white/80">다음: {NAMES[next]} · {remain}개 남음</span>
          </Link>
        ) : (
          <div className="mt-0.5 flex h-[50px] items-center gap-2 rounded-[14px] bg-good-bg pl-4 pr-1.5">
            <span className="flex-1 text-[17px] font-semibold text-good-ink">{p.todoDone < p.todoTotal ? `단어 끝! 할 일 ${p.todoTotal - p.todoDone}개 남음` : "오늘 분량 끝!"}</span>
            <Link href="/quiz?retry=1" className="flex h-[38px] items-center rounded-[10px] bg-card px-3.5 text-[15px] font-semibold text-accent">다시 풀어보기</Link>
          </div>
        )}
      </section>

      <TodayPlan d={d} me={mine} pt={pt} reload={load} />

      {sheet !== null && (
        <CheerSheet
          ptName={ptName} initial={sheet} onClose={() => setSheet(null)}
          onSent={() => { setSheet(null); load(); }}
        />
      )}
    </div>
  );
}

async function nextDayOf(): Promise<NextDay | null> {
  const last = await supabase.from("word_sets").select("book_id,position").not("book_id", "is", null).not("study_date", "is", null)
    .order("study_date", { ascending: false }).limit(1).maybeSingle();
  let q = supabase.from("word_sets").select("id,title,word_books(title)").is("study_date", null).not("book_id", "is", null);
  if (last.data) q = q.eq("book_id", last.data.book_id).gt("position", last.data.position);
  const { data } = await q.order("position").limit(1).maybeSingle();
  return (data as unknown as NextDay) ?? null;
}

function Avatar({ name, cls }: { name: string; cls: string }) {
  return <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${cls}`}>{name.slice(0, 1)}</span>;
}

function Row({ u, isMe, hasSet }: { u: UserDay; isMe: boolean; hasSet: boolean }) {
  const p = u.progress;
  const pct = pctOf(p.ratio);
  const f = (c: number, t: number) => (t > 0 && c >= t ? "✓" : c > 0 ? `${c}/${t}` : "–");
  const steps = [
    ...(hasSet ? [`뜻 ${f(p.en2ko, p.n)}`, `영어 ${f(p.ko2en, p.n)}`, `복습 ${p.reviewTotal === 0 ? "없음" : f(p.reviewDone, p.reviewTotal)}`] : []),
    ...(p.todoTotal ? [`할 일 ${f(p.todoDone, p.todoTotal)}`] : []),
  ];
  const note = !hasSet && !p.todoTotal ? "단어장 대기 중" : !isMe && pct === 0 ? "아직 시작 안 했어요" : !isMe && pct === 100 ? "오늘 끝냈어요" : null;
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

function TodayPlan({ d, me, pt, reload }: { d: Home; me: UserDay; pt?: UserDay; reload: () => void }) {
  const { ask } = useUI();
  const [title, setTitle] = useState("");
  const items = (uid: string) =>
    d.units.filter((x) => x.user_id === uid)
      .map((x) => ({ ...x, late: !x.done && x.scheduled_date < d.today }))
      .sort((a, b) => Number(a.done) - Number(b.done) || Number(b.late) - Number(a.late) || a.scheduled_date.localeCompare(b.scheduled_date));
  const mine = items(me.profile.id);
  const theirs = pt ? items(pt.profile.id) : [];
  const label = (x: Unit) => (x.book_plans ? `${x.book_plans.book_title} · ${x.title}` : x.title);
  const doneN = mine.filter((x) => x.done).length;

  async function toggle(x: Unit) {
    await supabase.from("book_units").update({ done: !x.done, done_date: x.done ? null : d.today }).eq("id", x.id);
    reload();
  }
  async function add() {
    const t = title.trim().slice(0, 40);
    if (!t) return;
    await supabase.from("book_units").insert({ title: t, scheduled_date: d.today });
    setTitle("");
    reload();
  }
  async function remove(x: Unit) {
    if (!(await ask("할 일을 지울까요?", x.title, "지우기"))) return;
    await supabase.from("book_units").delete().eq("id", x.id);
    reload();
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-1">
        <div className="text-lg font-bold">오늘의 계획</div>
        {mine.length > 0 && <div className="tnum text-[13px] text-l2">{doneN} / {mine.length} 끝냄</div>}
      </div>
      <div className="card overflow-hidden">
        <div className="flex flex-col px-4 pb-2 pt-1">
          {d.wordDay && (
            <div className="border-b border-bg py-2">
              <Link href={me.progress.wordRatio >= 1 ? "/quiz?retry=1" : "/quiz"} className="flex min-h-9 items-center gap-2.5">
                <Check done={me.progress.wordRatio >= 1} />
                <span className="min-w-0 flex-1 truncate text-[15px]">단어 · {d.wordDay.book ? `${d.wordDay.book} ` : ""}{d.wordDay.title}</span>
                <span className="tnum text-[13px] text-l2">{pctOf(me.progress.wordRatio)}%</span>
              </Link>
              <Resources list={resourcesFor(d.wordDay.title, d.wordDay.book, d.edition)} />
            </div>
          )}
          {mine.map((x) => (
            <div key={x.id} className="border-b border-bg py-1.5 last:border-0">
              <div className="flex min-h-10 items-center gap-2.5">
                <button onClick={() => toggle(x)} aria-label={x.done ? "안 끝낸 걸로" : "끝냈어요"} className="flex min-w-0 flex-1 items-center gap-2.5 border-0 bg-transparent p-0 text-left">
                  <Check done={x.done} />
                  <span className={`min-w-0 flex-1 text-[15px] leading-snug ${x.done ? "text-l3 line-through" : ""}`}>{label(x)}</span>
                </button>
                {x.late && <LateBadge />}
                {!x.plan_id && <button onClick={() => remove(x)} aria-label="할 일 지우기" className="h-9 w-7 border-0 bg-transparent text-sm text-l3">✕</button>}
              </div>
              {!x.done && <Resources list={resourcesFor(x.title, x.book_plans?.book_title ?? "", d.edition)} />}
            </div>
          ))}
          {!mine.length && !d.wordDay && (
            <div className="py-2.5 text-[15px] text-l2">{d.myPlanCount > 0 ? "오늘은 책 범위가 없어요 · 복습하거나 할 일을 적어 보세요" : "오늘 할 일을 적어 보세요"}</div>
          )}
          <form className="flex gap-2 pb-1 pt-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 40))} placeholder="+ 할 일 추가 (예: Part 4 Course 1 듣기)" aria-label="할 일"
              className="h-10 min-w-0 flex-1 rounded-[10px] border-0 bg-bg px-3 text-[15px] outline-none" />
            {title.trim() && <button className="h-10 rounded-[10px] border-0 bg-accent px-3.5 text-[15px] font-semibold text-white">추가</button>}
          </form>
        </div>
        {pt && (
          <>
            <div className="ml-4 h-[0.5px] bg-sep" />
            <div className="flex flex-col px-4 py-2">
              <div className="flex items-center justify-between pb-1 text-sm font-semibold text-pt-ink">
                <span>{pt.profile.name}</span>
                {theirs.length > 0 && <span className="tnum text-[13px] font-normal text-l2">{theirs.filter((x) => x.done).length} / {theirs.length}</span>}
              </div>
              {theirs.map((x) => (
                <div key={x.id} className="flex min-h-9 items-center gap-2.5">
                  <Check done={x.done} dim />
                  <span className={`min-w-0 flex-1 truncate text-[15px] ${x.done ? "text-l3 line-through" : ""}`}>{label(x)}</span>
                  {x.late && <LateBadge />}
                </div>
              ))}
              {!theirs.length && <div className="flex min-h-9 items-center text-[15px] text-l3">오늘 할 일 없음</div>}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/** 할 일에 맞춘 해커스 강의·MP3·교재 쪽 */
function Resources({ list }: { list: Resource[] }) {
  if (!list.length) return null;
  const icon = { 강의: "▶", MP3: "♪", 연습: "✎", 교재: "📖" } as const;
  return (
    <div className="flex flex-wrap gap-1.5 pb-1 pl-8 pt-1">
      {list.map((r) => {
        const cls = "flex min-h-8 items-center gap-1 rounded-lg bg-me-soft px-2.5 py-1 text-[13px] font-medium text-me";
        const body = <><span aria-hidden>{icon[r.type]}</span>{r.label}</>;
        return r.url.startsWith("/")
          ? <Link key={r.label} href={r.url} className={cls}>{body}</Link>
          : <a key={r.label} href={r.url} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>;
      })}
    </div>
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
