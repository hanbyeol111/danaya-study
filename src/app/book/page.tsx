"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useMe } from "@/components/Shell";
import { supabase, must } from "@/lib/supabase";
import { distributeUnits, shuffle, todayKST } from "@/lib/rules";
import { fmtDate } from "@/lib/browser";

type Unit = { id: string; user_id: string; plan_id: string; position: number; title: string; page: number | null; scheduled_date: string; done: boolean; done_date: string | null };
type Plan = { id: string; user_id: string; book_title: string; start_date: string; end_date: string; book_units: Unit[] };
type Note = { id: string; part: number | null; source: string; question: string; choices: string[]; my_answer: string; correct_answer: string; memo: string; solved: boolean };

export default function BookPage() {
  const [tab, setTab] = useState<"plans" | "notes">("plans");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "notes") setTab("notes");
  }, []);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">책</h1>
      <div className="flex gap-2">
        <button className={`btn flex-1 ${tab === "plans" ? "border-accent text-accent" : ""}`} onClick={() => setTab("plans")}>책 계획</button>
        <button className={`btn flex-1 ${tab === "notes" ? "border-accent text-accent" : ""}`} onClick={() => setTab("notes")}>오답 노트</button>
      </div>
      {tab === "plans" ? <Plans /> : <Notes />}
    </div>
  );
}

function Plans() {
  const me = useMe();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const [p, prof] = await Promise.all([
      supabase.from("book_plans").select("*,book_units(*)").order("created_at").then(must),
      supabase.from("profiles").select("id,name").then(must),
    ]);
    (p as Plan[]).forEach((x) => x.book_units.sort((a, b) => a.position - b.position));
    setPlans(p as Plan[]);
    setNames(Object.fromEntries((prof as { id: string; name: string }[]).map((x) => [x.id, x.name])));
  }, []);
  useEffect(() => { load(); }, [load]);
  if (!plans) return <p className="text-center text-muted">불러오는 중…</p>;

  const mine = plans.filter((p) => p.user_id === me.id);
  const others = plans.filter((p) => p.user_id !== me.id);
  return (
    <div className="flex flex-col gap-3">
      <Link href="/book/plan-new" className="btn-primary text-center">📷 목차로 새 계획 만들기</Link>
      {mine.length === 0 && <p className="text-sm text-muted">아직 계획이 없어요. 책 목차를 찍으면 시험 전까지 매일 나눠 줘요.</p>}
      {mine.map((p) => <PlanCard key={p.id} plan={p} editable reload={load} />)}
      {others.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-muted">{names[others[0].user_id]}의 계획 보기</summary>
          <div className="mt-2 flex flex-col gap-3">{others.map((p) => <PlanCard key={p.id} plan={p} editable={false} reload={load} />)}</div>
        </details>
      )}
    </div>
  );
}

function PlanCard({ plan, editable, reload }: { plan: Plan; editable: boolean; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const today = todayKST();
  const units = plan.book_units;
  const done = units.filter((u) => u.done).length;
  const byDate = new Map<string, Unit[]>();
  units.forEach((u) => byDate.set(u.scheduled_date, [...(byDate.get(u.scheduled_date) ?? []), u]));

  async function redistribute() {
    const left = units.filter((u) => !u.done);
    const end = plan.end_date < today ? today : plan.end_date;
    if (!left.length || !confirm(`안 끝낸 ${left.length}개를 오늘부터 ${fmtDate(end)}까지 다시 나눌까요?`)) return;
    const dates = distributeUnits(left.length, today, end);
    must(await supabase.from("book_units").upsert(left.map((u, i) => ({ ...u, scheduled_date: dates[i] }))));
    if (end !== plan.end_date) await supabase.from("book_plans").update({ end_date: end }).eq("id", plan.id);
    reload();
  }

  return (
    <div className="card p-0">
      <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpen(!open)}>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{plan.book_title}</p>
          <p className="text-sm text-muted">{done}/{units.length} · {fmtDate(plan.end_date)}까지</p>
        </div>
        <div className="h-2 w-20 overflow-hidden rounded-full bg-line"><div className="h-full bg-accent" style={{ width: `${units.length ? (done / units.length) * 100 : 0}%` }} /></div>
        <span className="text-muted">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-line p-4">
          <div className="flex flex-col gap-3">
            {[...byDate].map(([date, us]) => (
              <div key={date}>
                <p className={`text-xs ${date === today ? "font-bold text-accent" : "text-muted"}`}>{fmtDate(date)}{date === today ? " · 오늘" : ""}</p>
                {us.map((u) => (
                  <label key={u.id} className="flex items-start gap-2 py-0.5 text-sm">
                    <input
                      type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" checked={u.done} disabled={!editable}
                      onChange={async () => { await supabase.from("book_units").update({ done: !u.done, done_date: u.done ? null : today }).eq("id", u.id); reload(); }}
                    />
                    <span className={u.done ? "text-muted line-through" : !u.done && date < today ? "text-bad" : ""}>
                      {u.title}{u.page ? ` (p.${u.page})` : ""}
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </div>
          {editable && (
            <div className="mt-4 flex gap-2">
              <button className="btn" onClick={redistribute}>남은 범위 다시 나누기</button>
              <button
                className="btn-danger ml-auto"
                onClick={async () => { if (confirm(`"${plan.book_title}" 계획을 지울까요?`)) { await supabase.from("book_plans").delete().eq("id", plan.id); reload(); } }}
              >삭제</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Notes() {
  const me = useMe();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [part, setPart] = useState<number | 0>(0);
  const [solved, setSolved] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [practice, setPractice] = useState<Note[] | null>(null);
  const load = useCallback(async () => {
    setNotes(must(await supabase.from("wrong_notes").select("*").eq("user_id", me.id).order("created_at", { ascending: false })) as Note[]);
  }, [me.id]);
  useEffect(() => { load(); }, [load]);
  if (!notes) return <p className="text-center text-muted">불러오는 중…</p>;

  const unsolved = notes.filter((n) => !n.solved);
  if (practice) return <Practice queue={practice} onExit={() => { setPractice(null); load(); }} />;

  const list = notes.filter((n) => n.solved === solved && (!part || n.part === part));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Link href="/book/note-new" className="btn-primary flex-1 text-center text-base">📷 틀린 문제 추가</Link>
        <button className="btn flex-1" disabled={!unsolved.length} onClick={() => setPractice(shuffle(unsolved))}>다시 풀기 ({unsolved.length})</button>
      </div>
      <div className="flex gap-2">
        <button className={`btn flex-1 ${!solved ? "border-accent text-accent" : ""}`} onClick={() => setSolved(false)}>미해결</button>
        <button className={`btn flex-1 ${solved ? "border-accent text-accent" : ""}`} onClick={() => setSolved(true)}>해결</button>
        <select className="input w-24 py-2" value={part} onChange={(e) => setPart(Number(e.target.value))} aria-label="Part 필터">
          <option value={0}>전체</option>
          {[1, 2, 3, 4, 5, 6, 7].map((p) => <option key={p} value={p}>Part {p}</option>)}
        </select>
      </div>
      {list.length === 0 && <p className="text-sm text-muted">노트가 없어요</p>}
      {list.map((n) => (
        <div key={n.id} className="card p-0">
          <button className="w-full p-4 text-left" onClick={() => setOpen(open === n.id ? null : n.id)}>
            <p className="text-xs text-muted">{n.part ? `Part ${n.part}` : "Part ?"}{n.source ? ` · ${n.source}` : ""}</p>
            <p className={open === n.id ? "whitespace-pre-wrap" : "line-clamp-2"}>{n.question || "(문제 없음)"}</p>
          </button>
          {open === n.id && <NoteDetail note={n} reload={load} />}
        </div>
      ))}
    </div>
  );
}

function NoteDetail({ note, reload }: { note: Note; reload: () => void }) {
  const [edit, setEdit] = useState(false);
  const [answer, setAnswer] = useState(note.correct_answer);
  const [memo, setMemo] = useState(note.memo);
  return (
    <div className="flex flex-col gap-2 border-t border-line p-4 text-sm">
      {note.choices.map((c) => (
        <p key={c} className={c === note.correct_answer ? "font-bold text-good" : c === note.my_answer ? "text-bad line-through" : ""}>{c}</p>
      ))}
      {edit ? (
        <>
          <label className="text-muted">정답<input className="input mt-1" value={answer} onChange={(e) => setAnswer(e.target.value)} /></label>
          <label className="text-muted">메모<input className="input mt-1" value={memo} onChange={(e) => setMemo(e.target.value)} /></label>
          <div className="flex gap-2">
            <button className="btn" disabled={!answer.trim()} onClick={async () => { await supabase.from("wrong_notes").update({ correct_answer: answer.trim(), memo: memo.trim() }).eq("id", note.id); setEdit(false); reload(); }}>저장</button>
            <button className="btn" onClick={() => setEdit(false)}>취소</button>
          </div>
        </>
      ) : (
        <>
          <p>내 답: <span className="text-bad">{note.my_answer || "–"}</span> · 정답: <b className="text-good">{note.correct_answer}</b></p>
          {note.memo && <p className="text-muted">메모: {note.memo}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={() => setEdit(true)}>수정</button>
            <button className="btn" onClick={async () => { await supabase.from("wrong_notes").update({ solved: !note.solved }).eq("id", note.id); reload(); }}>
              {note.solved ? "미해결로" : "해결로"}
            </button>
            <button className="btn-danger ml-auto" onClick={async () => { if (confirm("이 노트를 지울까요?")) { await supabase.from("wrong_notes").delete().eq("id", note.id); reload(); } }}>삭제</button>
          </div>
        </>
      )}
    </div>
  );
}

function Practice({ queue, onExit }: { queue: Note[]; onExit: () => void }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const n = queue[i];
  const next = () => { setPicked(null); setReveal(false); if (i + 1 < queue.length) setI(i + 1); else onExit(); };
  if (!n) return null;
  const right = picked === n.correct_answer;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm text-muted">
        <button onClick={onExit}>✕ 그만하기</button>
        <span>{i + 1} / {queue.length}</span>
      </div>
      <div className="card">
        <p className="text-xs text-muted">{n.part ? `Part ${n.part}` : ""}{n.source ? ` · ${n.source}` : ""}</p>
        <p className="whitespace-pre-wrap">{n.question || "(문제 없음)"}</p>
      </div>
      {n.choices.length ? (
        n.choices.map((c) => (
          <button
            key={c} disabled={!!picked} onClick={() => setPicked(c)}
            className={`card text-left ${picked && c === n.correct_answer ? "border-good bg-good/10" : picked === c ? "border-bad bg-bad/10" : ""}`}
          >{c}</button>
        ))
      ) : !reveal ? (
        <button className="btn" onClick={() => { setReveal(true); setPicked(""); }}>정답 보기</button>
      ) : (
        <div className="card">정답: <b>{n.correct_answer}</b></div>
      )}
      {picked !== null && (
        <div className="flex flex-col gap-2">
          {n.choices.length > 0 && <p className={`font-bold ${right ? "text-good" : "text-bad"}`}>{right ? "정답!" : `오답 — 정답은 ${n.correct_answer}`}</p>}
          {n.memo && <p className="text-sm text-muted">메모: {n.memo}</p>}
          {(right || !n.choices.length) && (
            <button className="btn" onClick={async () => { await supabase.from("wrong_notes").update({ solved: true }).eq("id", n.id); next(); }}>해결로 옮기기</button>
          )}
          <button className="btn-primary" onClick={next}>다음</button>
        </div>
      )}
    </div>
  );
}
