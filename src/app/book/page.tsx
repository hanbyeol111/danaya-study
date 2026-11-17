"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useMe } from "@/components/Shell";
import { Bar, Check, Chip, LateBadge, Segment, Sub, TopBar, useUI } from "@/components/ui";
import { supabase, must } from "@/lib/supabase";
import { distributeUnits, todayKST } from "@/lib/rules";
import { dayLabel, fmtDate, kstDate } from "@/lib/browser";

type Unit = { id: string; user_id: string; plan_id: string | null; position: number; title: string; page: number | null; scheduled_date: string; done: boolean; done_date: string | null };
type Plan = { id: string; user_id: string; book_title: string; start_date: string; end_date: string; units: Unit[]; manual?: boolean };
type Note = { id: string; part: number | null; source: string; question: string; choices: string[]; my_answer: string; correct_answer: string; memo: string; solved: boolean; created_at: string };

export default function BookPage() {
  const [seg, setSeg] = useState<"plan" | "notes">("plan");
  const [openPlan, setOpenPlan] = useState<string | null>(null);
  const [openNote, setOpenNote] = useState<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("tab") === "notes") setSeg("notes");
    if (q.get("note")) { setSeg("notes"); setOpenNote(q.get("note")); }
    if (q.get("plan")) setOpenPlan(q.get("plan"));
    if (q.size) window.history.replaceState(null, "", "/book");
  }, []);
  return (
    <div className="flex flex-col gap-5">
      <div className="pt-1.5 text-[26px] font-bold">책</div>
      <Segment value={seg} options={[["plan", "책 계획"], ["notes", "오답 노트"]]} onChange={setSeg} />
      {seg === "plan" ? <Plans openId={openPlan} setOpenId={setOpenPlan} /> : <Notes openId={openNote} setOpenId={setOpenNote} />}
    </div>
  );
}

/* ================= 책 계획 ================= */

function Plans({ openId, setOpenId }: { openId: string | null; setOpenId: (id: string | null) => void }) {
  const me = useMe();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [ptOpen, setPtOpen] = useState(false);

  const load = useCallback(async () => {
    const [p, manual, prof] = await Promise.all([
      supabase.from("book_plans").select("*,units:book_units(*)").order("created_at").then(must),
      supabase.from("book_units").select("*").is("plan_id", null).order("scheduled_date").then(must),
      supabase.from("profiles").select("id,name").then(must),
    ]);
    const list = p as Plan[];
    list.forEach((x) => x.units.sort((a, b) => a.position - b.position));
    // 계획 없이 직접 적은 할 일은 사람별로 묶어 하나의 카드로
    for (const uid of new Set((manual as Unit[]).map((u) => u.user_id))) {
      const us = (manual as Unit[]).filter((u) => u.user_id === uid);
      list.push({ id: "manual-" + uid, user_id: uid, book_title: "직접 적은 할 일", start_date: us[0].scheduled_date, end_date: us[us.length - 1].scheduled_date, units: us, manual: true });
    }
    setPlans(list);
    setNames(Object.fromEntries((prof as { id: string; name: string }[]).map((x) => [x.id, x.name])));
  }, []);
  useEffect(() => { load(); }, [load]);
  if (!plans) return <p className="text-center text-l3">불러오는 중…</p>;

  const mine = plans.filter((p) => p.user_id === me.id);
  const theirs = plans.filter((p) => p.user_id !== me.id);
  const ptName = names[Object.keys(names).find((id) => id !== me.id) ?? ""] ?? "상대";
  const cur = plans.find((p) => p.id === openId);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="text-[17px] font-bold">내 계획</div>
          <Link href="/book/plan-new" className="flex h-11 items-center rounded-xl bg-accent px-3.5 text-sm font-semibold text-white">+ 새 계획</Link>
        </div>
        {mine.map((p) => <PlanCard key={p.id} p={p} color="bg-me" onOpen={() => setOpenId(p.id)} />)}
        {!mine.length && (
          <div className="rounded-2xl px-4 py-6 text-center text-[15px] leading-normal text-l2" style={{ border: "1.5px dashed var(--color-g4)" }}>
            아직 계획이 없어요.<br />책 목차를 찍으면 시험 전까지 날짜별로 나눠 드려요.
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2.5">
        <button onClick={() => setPtOpen(!ptOpen)} className="flex h-11 items-center justify-between border-0 bg-transparent p-0">
          <span className="text-[17px] font-bold">{ptName}의 계획</span>
          <span className="text-sm text-l2">{ptOpen ? "접기" : "펼치기"}</span>
        </button>
        {ptOpen && (theirs.length ? theirs.map((p) => <PlanCard key={p.id} p={p} color="bg-pt" view onOpen={() => setOpenId(p.id)} />) : <div className="text-[15px] text-l3">아직 계획이 없어요</div>)}
      </div>
      {cur && <PlanDetail plan={cur} mine={cur.user_id === me.id} owner={cur.user_id === me.id ? "내 계획" : `${names[cur.user_id] ?? ""}의 계획 · 보기 전용`} onBack={() => setOpenId(null)} reload={load} />}
    </div>
  );
}

function PlanCard({ p, color, view, onOpen }: { p: Plan; color: string; view?: boolean; onOpen: () => void }) {
  const d = p.units.filter((u) => u.done).length;
  const t = p.units.length;
  return (
    <button onClick={onOpen} className="flex flex-col gap-2.5 rounded-2xl border-0 bg-card p-4 text-left">
      <div className="flex w-full items-baseline gap-2">
        <span className="min-w-0 flex-1 text-[17px] font-bold">{p.book_title}</span>
        <span className="tnum text-[15px] font-bold">{d} / {t}</span>
      </div>
      <Bar pct={t ? (d / t) * 100 : 0} color={color} />
      <div className="text-[13px] text-l2">{p.manual ? "계획 없이 적은 할 일" : `${fmtDate(p.end_date)} 끝`}{view && " · 보기 전용"}</div>
    </button>
  );
}

function PlanDetail({ plan, mine, owner, onBack, reload }: { plan: Plan; mine: boolean; owner: string; onBack: () => void; reload: () => void }) {
  const { ask, toast } = useUI();
  const today = todayKST();
  const undone = plan.units.filter((u) => !u.done);
  const late = undone.filter((u) => u.scheduled_date < today).length;
  const byDate = new Map<string, Unit[]>();
  [...plan.units].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date) || a.position - b.position)
    .forEach((u) => byDate.set(u.scheduled_date, [...(byDate.get(u.scheduled_date) ?? []), u]));

  async function toggle(u: Unit) {
    if (!mine) return;
    await supabase.from("book_units").update({ done: !u.done, done_date: u.done ? null : today }).eq("id", u.id);
    reload();
  }
  async function rebalance() {
    const end = plan.end_date < today ? today : plan.end_date;
    if (!(await ask("남은 범위를 다시 나눌까요?", `안 끝낸 ${undone.length}개를 오늘부터 ${fmtDate(end)}까지 고르게 다시 배정해요. 끝낸 항목은 그대로예요.`, "다시 나누기"))) return;
    const dates = distributeUnits(undone.length, today, end);
    must(await supabase.from("book_units").upsert(undone.map((u, i) => ({ ...u, scheduled_date: dates[i] }))));
    if (end !== plan.end_date) await supabase.from("book_plans").update({ end_date: end }).eq("id", plan.id);
    toast("오늘부터 다시 나눴어요");
    reload();
  }
  async function remove() {
    if (!(await ask("계획을 지울까요?", `${plan.book_title} 계획과 항목 ${plan.units.length}개가 모두 지워져요.`, "지우기"))) return;
    if (plan.manual) await supabase.from("book_units").delete().in("id", plan.units.map((u) => u.id));
    else await supabase.from("book_plans").delete().eq("id", plan.id);
    toast("계획을 지웠어요");
    onBack();
    reload();
  }

  return (
    <Sub pad={false}>
      <TopBar back="책" onBack={onBack} className="px-5" right={mine && <button onClick={remove} className="h-11 border-0 bg-transparent pl-3 text-[15px] text-bad-ink">계획 삭제</button>} />
      <div className="flex flex-col gap-1 px-5 pb-3.5 pt-1">
        <div className="text-[13px] font-semibold text-l2">{owner}</div>
        <div className="text-2xl font-bold">{plan.book_title}</div>
        <div className="text-sm text-l2">{plan.units.filter((u) => u.done).length} / {plan.units.length} 끝냄{!plan.manual && ` · ${fmtDate(plan.start_date)} ~ ${fmtDate(plan.end_date)}`}</div>
      </div>
      {mine && !plan.manual && undone.length > 0 && (
        <div className="mx-5 mb-3 flex items-center gap-2.5 rounded-[14px] bg-card py-3 pl-4 pr-3">
          <div className="flex-1 text-sm leading-snug text-l4">{late > 0 && <><b className="text-bad-ink">밀린 항목 {late}개</b> · </>}남은 범위를 오늘부터 고르게</div>
          <button onClick={rebalance} className="h-10 rounded-[10px] border-0 bg-accent px-3 text-sm font-semibold text-white">다시 나누기</button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-5 pb-10">
        {[...byDate].map(([date, us]) => (
          <div key={date} className="flex gap-3 border-b border-g5 py-2.5">
            <div className="w-[86px] shrink-0 pt-3 text-[13px] font-semibold text-l2">
              {dayLabel(date)}
              {date === today && <div className="mt-1 inline-block rounded-[5px] bg-accent px-1.5 py-0.5 text-[11px] font-bold text-white">오늘</div>}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              {us.map((u) => (
                <button key={u.id} onClick={() => toggle(u)} disabled={!mine} className="flex min-h-11 items-center gap-2.5 border-0 bg-transparent px-0 py-0.5 text-left disabled:cursor-default">
                  <Check done={u.done} dim={!mine} />
                  <span className={`min-w-0 flex-1 text-[15px] leading-[1.35] ${u.done ? "text-l3 line-through" : "text-black"}`}>{u.title}</span>
                  {!u.done && u.scheduled_date < today && <LateBadge />}
                  {u.page && <span className="shrink-0 text-xs text-l3">p.{u.page}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Sub>
  );
}

/* ================= 오답 노트 ================= */

function Notes({ openId, setOpenId }: { openId: string | null; setOpenId: (id: string | null) => void }) {
  const me = useMe();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [part, setPart] = useState(0);
  const [tab, setTab] = useState<"open" | "done">("open");
  const [retry, setRetry] = useState(false);
  const load = useCallback(async () => {
    setNotes(must(await supabase.from("wrong_notes").select("*").eq("user_id", me.id).order("created_at", { ascending: false })) as Note[]);
  }, [me.id]);
  useEffect(() => { load(); }, [load]);
  if (!notes) return <p className="text-center text-l3">불러오는 중…</p>;

  const open = notes.filter((n) => !n.solved);
  const done = notes.filter((n) => n.solved);
  const list = (tab === "open" ? open : done).filter((n) => !part || n.part === part);
  const cur = notes.find((n) => n.id === openId);
  const tabCls = (on: boolean) => `-mb-px h-11 border-0 border-b-2 bg-transparent px-0.5 text-[15px] font-[650] ${on ? "border-accent text-accent" : "border-transparent text-l3"}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <Link href="/book/note-new" className="flex h-[52px] items-center justify-center rounded-[14px] bg-accent text-[15px] font-[650] text-white">+ 틀린 문제 추가</Link>
        <button onClick={() => open.length && setRetry(true)} className={`h-[52px] rounded-[14px] border border-g3 text-[15px] font-[650] ${open.length ? "bg-card" : "bg-bg"}`}>
          다시 풀기 <span className="font-medium text-l2">({open.length})</span>
        </button>
      </div>
      <div className="flex gap-5 border-b border-g5">
        <button onClick={() => setTab("open")} className={tabCls(tab === "open")}>미해결 {open.length}</button>
        <button onClick={() => setTab("done")} className={tabCls(tab === "done")}>해결 {done.length}</button>
      </div>
      <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((p) => <Chip key={p} on={part === p} onClick={() => setPart(p)}>{p ? p : "전체"}</Chip>)}
      </div>
      <div className="flex flex-col gap-2">
        {list.map((n) => (
          <button key={n.id} onClick={() => setOpenId(n.id)} className="flex flex-col gap-2 rounded-2xl border-0 bg-card px-4 py-3.5 text-left">
            <div className="flex w-full items-center gap-2">
              <span className="rounded-md bg-bg px-[7px] py-[3px] text-xs font-bold text-l4">{n.part ? `Part ${n.part}` : "Part ?"}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-l2">{n.source || "출처 없음"}</span>
              <span className="text-xs text-l3">{fmtDate(kstDate(n.created_at))}</span>
            </div>
            <div className="line-clamp-2 text-[15px] leading-[1.45]">{n.question || "(문제 없음)"}</div>
          </button>
        ))}
        {!list.length && <div className="py-9 text-center text-[15px] text-l3">해당하는 노트가 없어요</div>}
      </div>
      {cur && <NoteDetail n={cur} onBack={() => setOpenId(null)} reload={load} />}
      {retry && <Retry notes={notes} onClose={() => { setRetry(false); load(); }} />}
    </div>
  );
}

function NoteDetail({ n, onBack, reload }: { n: Note; onBack: () => void; reload: () => void }) {
  const { ask, toast } = useUI();
  return (
    <Sub pad={false}>
      <TopBar back="오답 노트" onBack={onBack} className="gap-1 px-5" right={
        <>
          <Link href={`/book/note-new?edit=${n.id}`} className="flex h-11 items-center px-2.5 text-[15px] text-l4">수정</Link>
          <button
            onClick={async () => { if (await ask("이 오답 노트를 지울까요?", "지운 노트는 되돌릴 수 없어요.", "지우기")) { await supabase.from("wrong_notes").delete().eq("id", n.id); toast("지웠어요"); onBack(); reload(); } }}
            className="h-11 border-0 bg-transparent pl-2.5 text-[15px] text-bad-ink"
          >삭제</button>
        </>
      } />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5 pt-1">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-accent px-2 py-1 text-[13px] font-bold text-white">{n.part ? `Part ${n.part}` : "Part 모름"}</span>
          <span className="text-sm text-l2">{n.source}</span>
          <span className="flex-1" />
          <span className="text-[13px] text-l3">{fmtDate(kstDate(n.created_at))} 추가</span>
        </div>
        <div className="whitespace-pre-wrap text-lg font-medium leading-[1.55]">{n.question}</div>
        {n.choices.length ? (
          <div className="flex flex-col gap-2">
            {n.choices.map((c) => {
              const isC = c === n.correct_answer, isM = c === n.my_answer;
              return (
                <div key={c} className={`flex min-h-[50px] items-center gap-2.5 rounded-xl px-3.5 py-2.5 ${isC ? "border-good bg-good-bg" : isM ? "border-bad bg-bad-bg" : "border-g5 bg-card"}`} style={{ borderWidth: 1.5 }}>
                  <span className="flex-1 text-base">{c}</span>
                  <span className={`text-xs font-bold ${isC ? "text-good" : "text-bad"}`}>{isC ? "정답" : isM ? "내 답" : ""}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="rounded-xl bg-bad-bg px-3.5 py-3 text-[15px]"><span className="font-bold text-bad-ink">내 답</span> · {n.my_answer || "–"}</div>
            <div className="rounded-xl bg-good-bg px-3.5 py-3 text-[15px]"><span className="font-bold text-good-ink">정답</span> · {n.correct_answer}</div>
          </div>
        )}
        {n.memo && (
          <div className="flex flex-col gap-1 rounded-[14px] bg-card px-4 py-3.5">
            <div className="text-[13px] font-bold text-l2">왜 틀렸나</div>
            <div className="text-base leading-normal">{n.memo}</div>
          </div>
        )}
      </div>
      <div className="border-t border-g5 px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-3">
        <button
          onClick={async () => { await supabase.from("wrong_notes").update({ solved: !n.solved }).eq("id", n.id); toast(n.solved ? "미해결로 되돌렸어요" : "해결로 옮겼어요"); reload(); }}
          className="h-[54px] w-full rounded-[14px] border border-g3 bg-card text-base font-[650]"
        >{n.solved ? "미해결로 되돌리기" : "해결로 옮기기"}</button>
      </div>
    </Sub>
  );
}

function Retry({ notes, onClose }: { notes: Note[]; onClose: () => void }) {
  const { toast } = useUI();
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const pick = (skip?: string, gone: Set<string> = solved) => {
    const open = notes.filter((n) => !n.solved && !gone.has(n.id));
    const pool = open.length > 1 ? open.filter((n) => n.id !== skip) : open;
    return pool[Math.floor(Math.random() * pool.length)];
  };
  const [cur, setCur] = useState<Note | undefined>(() => pick());
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const openN = notes.filter((n) => !n.solved && !solved.has(n.id)).length;

  function go(n?: Note) {
    if (!n) { toast("미해결 문제를 모두 해결했어요"); return onClose(); }
    setCur(n); setPicked(null); setRevealed(false);
  }
  async function solve() {
    await supabase.from("wrong_notes").update({ solved: true }).eq("id", cur!.id);
    toast("해결로 옮겼어요");
    const s = new Set(solved).add(cur!.id);
    setSolved(s);
    go(pick(undefined, s));
  }
  if (!cur) return null;
  const ok = picked !== null && picked === cur.correct_answer;
  const showNext = (picked !== null && !ok) || revealed;

  return (
    <Sub>
      <div className="flex h-12 items-center">
        <button onClick={onClose} className="h-11 border-0 bg-transparent pr-3 text-[15px] text-l2">✕ 그만하기</button>
        <div className="flex-1" />
        <div className="text-sm text-l2">다시 풀기 · 미해결 {openN}개 중</div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-accent px-2 py-1 text-[13px] font-bold text-white">{cur.part ? `Part ${cur.part}` : "Part ?"}</span>
          <span className="text-sm text-l2">{cur.source}</span>
        </div>
        <div className="whitespace-pre-wrap text-[19px] font-medium leading-[1.55]">{cur.question}</div>
        {cur.choices.length > 0 && (
          <div className="flex flex-col gap-2">
            {cur.choices.map((c) => {
              const cls = !picked ? "border-g5 bg-card" : c === cur.correct_answer ? "border-good bg-good-bg" : c === picked ? "border-bad bg-bad-bg" : "border-g5 bg-card text-l3";
              return <button key={c} disabled={!!picked} onClick={() => setPicked(c)} className={`min-h-[54px] rounded-xl px-3.5 py-2.5 text-left text-base ${cls}`} style={{ borderWidth: 1.5 }}>{c}</button>;
            })}
          </div>
        )}
        {!cur.choices.length && !revealed && (
          <button onClick={() => setRevealed(true)} className="h-[72px] rounded-[14px] bg-transparent text-base font-semibold text-l4" style={{ border: "1.5px dashed var(--color-g4)" }}>머릿속으로 답을 떠올린 뒤 · 정답 보기</button>
        )}
        {ok && (
          <div className="flex flex-col gap-3 rounded-[14px] bg-good-bg p-4">
            <div className="text-[17px] font-bold text-good-ink">맞았어요! 해결로 옮길까요?</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => go(pick(cur.id))} className="h-12 rounded-xl border border-g3 bg-card text-[15px] font-semibold">아니요, 다음</button>
              <button onClick={solve} className="h-12 rounded-xl border-0 bg-accent text-[15px] font-[650] text-white">예, 옮기기</button>
            </div>
          </div>
        )}
        {showNext && (
          <>
            <div className="flex flex-col gap-2 rounded-[14px] bg-card p-4">
              <div className="text-[15px]"><span className="font-bold text-good-ink">정답</span> · {cur.correct_answer}</div>
              {cur.memo && <div className="text-[15px] leading-normal text-l4">{cur.memo}</div>}
            </div>
            {revealed && <button onClick={solve} className="h-[50px] rounded-[14px] border border-g3 bg-card text-[15px] font-semibold">맞혔어요 · 해결로 옮기기</button>}
            <button onClick={() => go(pick(cur.id))} className="h-[54px] rounded-[14px] border-0 bg-accent text-base font-[650] text-white">다음 문제</button>
          </>
        )}
      </div>
    </Sub>
  );
}
