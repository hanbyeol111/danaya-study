"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMe } from "@/components/Shell";
import { PlayButton, Spinner } from "@/components/ui";
import { loadToday, markComplete, type Word } from "@/lib/day";
import { gradeTyped, reviewOnCorrect, reviewOnWrong, shuffle } from "@/lib/rules";
import { supabase, must } from "@/lib/supabase";
import { speak } from "@/lib/browser";

type Mode = "en2ko" | "ko2en" | "review";
const NAMES: Record<Mode, string> = { en2ko: "뜻 맞히기", ko2en: "영어 맞히기", review: "복습" };
const ORDER: Mode[] = ["en2ko", "ko2en", "review"];

type Stage = {
  mode: Mode;
  queue: Word[]; // 아직 못 맞힌 단어 (틀리면 뒤로)
  total: number; // 단계 전체 단어 수
  done: number; // 맞힌 수 (이전에 맞힌 것 포함)
  pool: number; // 이번에 푼 단어 수
  wrong: Word[];
  seq: number; // 문제 화면을 매번 새로 그리기 위한 번호
};
type Plan = { mode: Mode; left: Word[]; done: number; total: number } | null;

/** 오늘 남은 첫 단계 (after 다음부터) */
async function nextPlan(meId: string, after?: Mode): Promise<{ plan: Plan; today: string; words: Word[]; ratio: number; ptName: string }> {
  const day = await loadToday();
  const mine = day.users.find((u) => u.profile.id === meId)!;
  const ptName = day.users.find((u) => u.profile.id !== meId)?.profile.name ?? "상대";
  const base = { today: day.today, words: day.words, ratio: mine.progress.ratio, ptName };
  if (!day.setId) return { plan: null, ...base };
  for (const m of ORDER.slice(after ? ORDER.indexOf(after) + 1 : 0)) {
    if (m === "review") {
      const left = mine.reviewQueue.filter((id) => !mine.reviewPassed.has(id));
      if (!left.length) continue;
      const ws = must(await supabase.from("words").select("id,set_id,english,korean,pos,position").in("id", left)) as Word[];
      return { plan: { mode: m, left: ws, done: mine.reviewQueue.length - left.length, total: mine.reviewQueue.length }, ...base };
    }
    const c = new Set(mine.attempts.filter((a) => a.mode === m && a.correct).map((a) => a.word_id));
    const left = day.words.filter((w) => !c.has(w.id));
    if (left.length) return { plan: { mode: m, left, done: day.words.length - left.length, total: day.words.length }, ...base };
  }
  return { plan: null, ...base };
}

const makeStage = (p: NonNullable<Plan>): Stage => ({ mode: p.mode, queue: shuffle(p.left), total: p.total, done: p.done, pool: p.left.length, wrong: [], seq: 0 });

export default function QuizPage() {
  const me = useMe();
  const router = useRouter();
  const [ctx, setCtx] = useState<{ today: string; words: Word[]; pool: string[]; retry: boolean; ptName: string } | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [result, setResult] = useState<{ stage: Stage; next: Plan } | null>(null);
  const [empty, setEmpty] = useState<"noset" | "done" | null>(null);
  const failedReview = useRef(new Set<string>());

  useEffect(() => {
    (async () => {
      const retry = new URLSearchParams(window.location.search).has("retry");
      const { plan, today, words, ptName } = await nextPlan(me.id);
      // 오답 보기 후보: 오늘 세트 뜻 + (4개 미만이면) 이전 세트 뜻
      let pool = words.map((w) => w.korean);
      if (pool.length < 4) {
        const prev = must(await supabase.from("words").select("korean").limit(50)) as { korean: string }[];
        pool = [...new Set([...pool, ...prev.map((p) => p.korean)])];
      }
      const { data: fails } = await supabase.from("attempts").select("word_id").eq("user_id", me.id).eq("study_date", today).eq("mode", "review").eq("correct", false);
      failedReview.current = new Set((fails ?? []).map((f) => f.word_id));
      setCtx({ today, words, pool, retry, ptName });
      if (!words.length) return setEmpty("noset");
      if (retry) return setStage(makeStage({ mode: "en2ko", left: words, done: 0, total: words.length }));
      if (plan) setStage(makeStage(plan));
      else setEmpty("done");
    })();
  }, [me.id]);

  async function answer(word: Word, correct: boolean) {
    const s = stage!;
    if (!ctx!.retry) {
      await supabase.from("attempts").insert({ word_id: word.id, mode: s.mode, correct, study_date: ctx!.today });
      if (!correct) {
        if (s.mode === "review") failedReview.current.add(word.id);
        await supabase.from("review_items").upsert({ user_id: me.id, word_id: word.id, ...reviewOnWrong(ctx!.today) });
      } else if (s.mode === "review") {
        const item = must(await supabase.from("review_items").select("stage,due_date").eq("user_id", me.id).eq("word_id", word.id).single());
        await supabase.from("review_items").update(reviewOnCorrect(item!, ctx!.today, failedReview.current.has(word.id))).eq("user_id", me.id).eq("word_id", word.id);
      }
    }
  }

  async function next(word: Word, correct: boolean) {
    const s = stage!;
    const [, ...rest] = s.queue;
    const base = { ...s, seq: s.seq + 1 };
    const n: Stage = correct
      ? { ...base, queue: rest, done: s.done + 1 }
      : { ...base, queue: [...rest, word], wrong: s.wrong.some((w) => w.id === word.id) ? s.wrong : [...s.wrong, word] };
    if (n.queue.length) return setStage(n);
    setStage(null);
    if (ctx!.retry) return setResult({ stage: n, next: null });
    const r = await nextPlan(me.id, n.mode);
    if (!r.plan && r.ratio >= 1) await markComplete(me.id, r.today);
    setResult({ stage: n, next: r.plan });
  }

  if (!ctx) return <div className="flex min-h-[80dvh]"><Spinner text="불러오는 중" /></div>;

  if (empty)
    return (
      <div className="flex min-h-[80dvh] flex-col justify-center gap-3 text-center">
        <p className="mb-3 text-lg font-semibold">{empty === "noset" ? "오늘 단어장이 아직 없어요" : "오늘 분량 끝!"}</p>
        {empty === "noset" && <Link href="/words/new" className="btn-primary">오늘 단어장 사진 올리기</Link>}
        <Link href="/" className="btn-secondary">홈으로</Link>
      </div>
    );

  if (result) {
    const { stage: r, next: nx } = result;
    const allDone = !nx && !ctx.retry;
    return (
      <div className="flex min-h-[calc(100dvh-60px)] flex-col gap-5 pt-2">
        <div className="flex flex-col gap-1.5">
          <div className="text-sm font-semibold text-l2">{NAMES[r.mode]}{ctx.retry && " · 다시 풀기"} 완료</div>
          {allDone && <div className="text-[28px] font-bold leading-[1.3]">오늘 분량 끝!</div>}
          <div className="text-base text-l4">한 번에 맞힌 단어 <b className="tnum">{r.pool - r.wrong.length}</b> / {r.pool}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-[18px] bg-card px-4 py-1.5">
          {r.wrong.length ? (
            <>
              <div className="pb-1.5 pt-3 text-sm font-bold">틀린 단어 {r.wrong.length}개</div>
              {r.wrong.map((w) => (
                <div key={w.id} className="flex min-h-[52px] items-center gap-3 border-t border-bg">
                  <div className="min-w-0 flex-1"><div className="text-base font-[650]">{w.english}</div><div className="text-sm text-l2">{w.korean}</div></div>
                  <PlayButton text={w.english} size={44} />
                </div>
              ))}
              {r.mode !== "review" && !ctx.retry && <div className="pb-2 pt-2.5 text-[13px] text-l3">틀린 단어는 내일 복습에 나와요</div>}
            </>
          ) : <div className="py-7 text-center text-base text-l2">틀린 단어 없이 다 맞혔어요</div>}
        </div>
        <div className="flex flex-col gap-2.5">
          {nx && <button className="btn-primary" onClick={() => { setResult(null); setStage(makeStage(nx)); }}>다음 단계 · {NAMES[nx.mode]}</button>}
          {allDone && <button className="btn-primary" onClick={() => router.push(`/?cheer=${encodeURIComponent("나 오늘 분량 끝냈어!")}`)}>{ctx.ptName}에게 알리기</button>}
          <Link href="/" className="btn-secondary">홈으로</Link>
        </div>
      </div>
    );
  }

  if (!stage) return null;
  return (
    <Question
      key={stage.seq} stage={stage} pool={ctx.pool} retry={ctx.retry}
      onAnswer={answer} onNext={next}
    />
  );
}

function Question({ stage, pool, retry, onAnswer, onNext }: {
  stage: Stage; pool: string[]; retry: boolean;
  onAnswer: (w: Word, c: boolean) => Promise<void>; onNext: (w: Word, c: boolean) => Promise<void>;
}) {
  const word = stage.queue[0];
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [choices] = useState(() => shuffle([word.korean, ...shuffle(pool.filter((k) => k !== word.korean)).slice(0, 3)]));
  const choice = stage.mode === "en2ko";
  const answered = ok !== null;

  async function judge(correct: boolean) {
    if (answered) return;
    setOk(correct);
    await onAnswer(word, correct);
  }
  async function next() {
    if (busy) return;
    setBusy(true);
    await onNext(word, ok!);
  }

  return (
    <div className="flex min-h-[calc(100dvh-60px)] flex-col">
      <div className="flex h-12 items-center gap-2">
        <Link href="/" className="flex h-11 items-center pr-3 text-[15px] text-l2">✕ 그만하기</Link>
        <div className="flex-1" />
        <div className="tnum text-[15px] font-bold">{stage.done} / {stage.total}</div>
      </div>
      <div className="flex flex-col gap-2 pt-1">
        <div className="text-sm font-semibold text-l2">{NAMES[stage.mode]}{retry && " · 다시 풀기"}</div>
        <div className="h-1.5 overflow-hidden rounded-[3px] bg-g5"><div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${(stage.done / stage.total) * 100}%` }} /></div>
      </div>
      <div className="flex flex-1 flex-col gap-6 pt-9">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <div className="text-sm text-l3">{choice ? "알맞은 뜻을 고르세요" : "영어 단어를 입력하세요"}</div>
          <div className="text-[34px] font-bold leading-tight tracking-[-0.02em]">{choice ? word.english : word.korean}</div>
          {choice && (
            <button onClick={() => speak(word.english)} className="flex h-10 items-center gap-1.5 rounded-full border border-g3 bg-card px-4 text-sm text-l4">▶ 발음 듣기</button>
          )}
        </div>

        {choice ? (
          <div className="flex flex-col gap-2.5">
            {choices.map((c, i) => {
              const right = answered && c === word.korean;
              const mineWrong = answered && c === picked && !right;
              const cls = right ? "border-good bg-good-bg" : mineWrong ? "border-bad bg-bad-bg" : answered ? "border-g5 bg-card text-l3" : "border-g5 bg-card";
              return (
                <button key={c} disabled={answered} onClick={() => { setPicked(c); judge(c === word.korean); }}
                  className={`flex min-h-[60px] items-center gap-3.5 rounded-[14px] px-4 py-3 text-left text-[17px] font-medium ${cls}`} style={{ borderWidth: 1.5 }}>
                  <span className="flex size-[26px] shrink-0 items-center justify-center rounded-lg bg-bg text-[13px] font-bold text-l2">{i + 1}</span>
                  <span className="min-w-0 flex-1 leading-[1.35]">{c}</span>
                  {right && <span className="text-xs font-bold text-good">정답</span>}
                  {mineWrong && <span className="text-xs font-bold text-bad">내 답</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <form className="flex flex-col gap-2.5" onSubmit={(e) => { e.preventDefault(); if (!answered) { if (typed.trim()) judge(gradeTyped(typed, word.english)); } else next(); }}>
            <input
              value={typed} onChange={(e) => setTyped(e.target.value)} readOnly={answered} placeholder="영어로 입력" autoFocus
              autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
              className={`h-[60px] rounded-[14px] bg-card px-[18px] text-center text-[22px] font-semibold outline-none ${answered ? (ok ? "border-good" : "border-bad") : "border-g3"}`}
              style={{ borderWidth: 1.5 }}
            />
            {!answered && (
              <div className="flex gap-2.5">
                <button type="button" onClick={() => judge(false)} className="h-[54px] rounded-[14px] border border-g3 bg-card px-[18px] text-[15px] text-l2">모르겠어요</button>
                <button disabled={!typed.trim()} className="h-[54px] flex-1 rounded-[14px] border-0 bg-accent text-[17px] font-[650] text-white disabled:bg-g4">확인</button>
              </div>
            )}
          </form>
        )}

        {answered && (
          <div className="flex flex-col gap-3">
            {ok ? (
              <div className="flex items-center gap-2.5 rounded-[14px] bg-good-bg px-4 py-3.5">
                <span className="text-[17px] font-bold text-good-ink">맞았어요</span>
                <span className="flex-1" />
                <span className="text-[15px] text-l4">{word.english} · {word.korean}</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 rounded-[14px] bg-bad-bg px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-[17px] font-bold text-bad-ink">정답은</span>
                  <span className="text-xl font-bold">{word.english}</span>
                  <span className="flex-1" />
                  <button onClick={() => speak(word.english)} className="h-9 rounded-full border border-g5 bg-card px-3 text-[13px] text-l4">▶ 발음</button>
                </div>
                <div className="text-sm text-l2">{word.korean} · 이 단어는 이번 단계 끝에 다시 나와요</div>
              </div>
            )}
            <button className="btn-primary" disabled={busy} onClick={next} autoFocus={choice}>다음</button>
          </div>
        )}
      </div>
    </div>
  );
}
