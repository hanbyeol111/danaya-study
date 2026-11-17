"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMe } from "@/components/Shell";
import SpeakButton from "@/components/SpeakButton";
import { loadToday, markComplete, type Word } from "@/lib/day";
import { gradeTyped, reviewOnCorrect, reviewOnWrong, shuffle } from "@/lib/rules";
import { supabase, must } from "@/lib/supabase";

type Mode = "en2ko" | "ko2en" | "review";
const NAMES: Record<Mode, string> = { en2ko: "뜻 맞히기", ko2en: "영어 맞히기", review: "복습" };

type Stage = {
  mode: Mode;
  queue: Word[]; // 아직 못 맞힌 단어 (틀리면 뒤로)
  total: number;
  done: number;
  wrong: Word[]; // 이번 세션에서 틀린 단어
  correctNow: number;
  seq: number; // 문제 화면을 매번 새로 그리기 위한 번호
};

export default function QuizPage() {
  const me = useMe();
  const [ctx, setCtx] = useState<{ today: string; words: Word[]; pool: string[]; retry: boolean } | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [finished, setFinished] = useState<Stage | null>(null);
  const [allDone, setAllDone] = useState(false);
  const failedReview = useRef(new Set<string>());

  async function start(nextAfter?: Mode) {
    const day = await loadToday();
    const mine = day.users.find((u) => u.profile.id === me.id)!;
    const retry = new URLSearchParams(window.location.search).has("retry");
    // 오답 보기 후보: 오늘 세트 뜻 + (4개 미만이면) 이전 세트 뜻
    let pool = day.words.map((w) => w.korean);
    if (pool.length < 4) {
      const prev = must(await supabase.from("words").select("korean").limit(50)) as { korean: string }[];
      pool = [...new Set([...pool, ...prev.map((p) => p.korean)])];
    }
    setCtx({ today: day.today, words: day.words, pool, retry });
    if (!day.setId) return setStage(null);

    if (retry) return setStage(makeStage("en2ko", day.words, 0));

    const correct = (m: Mode) => new Set(mine.attempts.filter((a) => a.mode === m && a.correct).map((a) => a.word_id));
    failedReview.current = new Set(mine.attempts.filter((a) => a.mode === "review" && !a.correct).map((a) => a.word_id));
    const order: Mode[] = ["en2ko", "ko2en", "review"];
    for (const m of order.slice(nextAfter ? order.indexOf(nextAfter) + 1 : 0)) {
      if (m === "review") {
        const left = mine.reviewQueue.filter((id) => !mine.reviewPassed.has(id));
        if (!left.length) continue;
        const ws = must(await supabase.from("words").select("id,set_id,english,korean,position").in("id", left)) as Word[];
        return setStage(makeStage("review", ws, mine.reviewQueue.length - left.length, mine.reviewQueue.length));
      }
      const c = correct(m);
      const left = day.words.filter((w) => !c.has(w.id));
      if (left.length) return setStage(makeStage(m, left, day.words.length - left.length, day.words.length));
    }
    setStage(null);
    setAllDone(true);
    if (mine.progress.ratio >= 1) await markComplete(me.id, day.today);
  }

  useEffect(() => { start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    const [, ...rest] = s.queue;
    const base = { ...s, seq: s.seq + 1 };
    const next: Stage = correct
      ? { ...base, queue: rest, done: s.done + 1, correctNow: s.correctNow + 1 }
      : { ...base, queue: [...rest, word], wrong: s.wrong.some((w) => w.id === word.id) ? s.wrong : [...s.wrong, word] };
    if (next.queue.length) setStage(next);
    else {
      setStage(null);
      setFinished(next);
    }
  }

  if (!ctx) return <p className="p-8 text-center text-muted">불러오는 중…</p>;
  if (!ctx.words.length)
    return (
      <div className="flex flex-col gap-4 pt-10 text-center">
        <p>오늘 단어장이 아직 없어요.</p>
        <Link href="/words/new" className="btn-primary">📷 오늘 단어장 사진 올리기</Link>
        <Link href="/" className="btn">홈으로</Link>
      </div>
    );

  if (finished)
    return (
      <div className="flex flex-col gap-4 pt-4">
        <h1 className="h1">{NAMES[finished.mode]} 끝!</h1>
        <div className="card">
          <p>이번에 맞힌 문제 <b>{finished.correctNow}</b>개{finished.wrong.length ? `, 틀린 단어 ${finished.wrong.length}개` : " — 하나도 안 틀렸어요 👏"}</p>
          {finished.wrong.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {finished.wrong.map((w) => (
                <li key={w.id} className="flex items-center gap-2 text-sm">
                  <SpeakButton text={w.english} /><b>{w.english}</b> <span className="text-muted">{w.korean}</span>
                </li>
              ))}
            </ul>
          )}
          {finished.wrong.length > 0 && !ctx.retry && <p className="mt-3 text-xs text-muted">틀린 단어는 내일 복습에 나와요.</p>}
        </div>
        {!ctx.retry && <button className="btn-primary" onClick={() => { const m = finished.mode; setFinished(null); start(m); }}>다음 단계</button>}
        <Link href="/" className="btn text-center">홈으로</Link>
      </div>
    );

  if (allDone || !stage)
    return (
      <div className="flex flex-col gap-4 pt-10 text-center">
        <p className="text-2xl font-bold text-good">🎉 오늘 분량 끝!</p>
        <Link href="/" className="btn-primary">홈으로</Link>
      </div>
    );

  return <Question key={stage.seq} stage={stage} pool={ctx.pool} onAnswer={answer} />;
}

function makeStage(mode: Mode, words: Word[], done: number, total = words.length): Stage {
  return { mode, queue: shuffle(words), total, done, wrong: [], correctNow: 0, seq: 0 };
}

function Question({ stage, pool, onAnswer }: { stage: Stage; pool: string[]; onAnswer: (w: Word, c: boolean) => Promise<void> }) {
  const word = stage.queue[0];
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [choices] = useState(() =>
    shuffle([word.korean, ...shuffle(pool.filter((k) => k !== word.korean)).slice(0, 3)]),
  );
  const typing = stage.mode !== "en2ko";

  function judge(correct: boolean) {
    setResult(correct);
  }
  async function next() {
    setBusy(true);
    await onAnswer(word, result!);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-muted" aria-label="홈으로">✕</Link>
        <span className="font-bold">{NAMES[stage.mode]}</span>
        <span className="text-sm text-muted">{stage.done} / {stage.total}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full bg-accent" style={{ width: `${(stage.done / stage.total) * 100}%` }} />
      </div>

      <div className="card flex min-h-36 flex-col items-center justify-center gap-3 text-center">
        {typing ? (
          <p className="text-2xl font-bold">{word.korean}</p>
        ) : (
          <>
            <p className="text-3xl font-bold">{word.english}</p>
            <SpeakButton text={word.english} />
          </>
        )}
      </div>

      {typing ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (result === null && typed.trim()) judge(gradeTyped(typed, word.english));
            else if (result !== null && !busy) next();
          }}
        >
          <input
            className="input text-center text-xl" value={typed} onChange={(e) => setTyped(e.target.value)} readOnly={result !== null}
            placeholder="영어 단어 입력" autoFocus autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
          />
          {result === null && <button className="btn-primary" disabled={!typed.trim()}>확인</button>}
        </form>
      ) : (
        <div className="flex flex-col gap-2">
          {choices.map((c) => {
            const show = result !== null;
            const style = show && c === word.korean ? "border-good bg-good/10" : show && c === picked ? "border-bad bg-bad/10" : "";
            return (
              <button
                key={c} disabled={show} className={`card text-left ${style}`}
                onClick={() => { setPicked(c); judge(c === word.korean); }}
              >
                {c}
              </button>
            );
          })}
        </div>
      )}

      {result !== null && (
        <div className="flex flex-col gap-3">
          <div className={`card flex items-center gap-2 ${result ? "border-good" : "border-bad"}`}>
            <span className={`font-bold ${result ? "text-good" : "text-bad"}`}>{result ? "정답!" : "오답"}</span>
            {!result && (
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span>정답: <b>{word.english}</b> · {word.korean}</span>
                <SpeakButton text={word.english} />
              </span>
            )}
          </div>
          <button className="btn-primary" disabled={busy} onClick={next} autoFocus={!typing}>다음</button>
        </div>
      )}
    </div>
  );
}
