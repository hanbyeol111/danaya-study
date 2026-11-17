"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMe } from "@/components/Shell";
import { PlayButton, Spinner, TopBar } from "@/components/ui";
import { MeaningChips } from "@/components/WordRow";
import { loadLibrary } from "@/lib/words";
import { gradeTyped, shuffle, todayKST } from "@/lib/rules";
import { supabase } from "@/lib/supabase";
import { speak } from "@/lib/browser";
import type { Word } from "@/lib/day";

type Mode = "blink" | "flash" | "choice" | "spell";
const NAMES: Record<Mode, string> = { blink: "깜빡이", flash: "플래시카드", choice: "객관식", spell: "받아쓰기" };

/** 자유 연습 기록. 오늘 진도에는 들어가지 않고, 단어장의 외움/헷갈림에만 쓰인다 */
const record = async (word_id: string, correct: boolean) => void await
  supabase.from("attempts").insert({ word_id, mode: "practice", correct, study_date: todayKST() });

export default function StudyPage() {
  const me = useMe();
  const router = useRouter();
  const [ctx, setCtx] = useState<{ mode: Mode; words: Word[]; pool: string[]; back: string } | null>(null);
  const [round, setRound] = useState<{ words: Word[]; seq: number } | null>(null);

  useEffect(() => {
    (async () => {
      const p = new URLSearchParams(window.location.search);
      const id = p.get("id") ?? "none", day = p.get("day"), f = p.get("f");
      const mode = (p.get("mode") ?? "flash") as Mode;
      const lib = await loadLibrary(me.id);
      const book = lib.books.find((b) => (b.id ?? "none") === id);
      const words = (book?.days.find((d) => d.id === day)?.words ?? book?.words ?? [])
        .filter((w) => !f || (lib.status.get(w.id) ?? "new") === f);
      // 객관식 오답 후보: 단어장 전체 뜻 (4개 미만이면 다른 단어장까지)
      let pool = [...new Set((book?.words ?? []).map((w) => w.korean))];
      if (pool.length < 4) pool = [...new Set(lib.books.flatMap((b) => b.words.map((w) => w.korean)))];
      setCtx({ mode, words, pool, back: `/words/book?id=${id}` });
      setRound({ words: mode === "blink" ? words : shuffle(words), seq: 0 });
    })();
  }, [me.id]);

  if (!ctx || !round) return <div className="flex min-h-[80dvh]"><Spinner text="불러오는 중" /></div>;
  if (!ctx.words.length)
    return (
      <div className="flex min-h-[80dvh] flex-col justify-center gap-4 text-center">
        <p className="text-lg font-semibold">공부할 단어가 없어요</p>
        <button className="btn-secondary" onClick={() => router.replace(ctx.back)}>단어장으로</button>
      </div>
    );

  const exit = () => { speechSynthesis?.cancel(); router.replace(ctx.back); };
  const again = (ws: Word[]) => setRound({ words: shuffle(ws), seq: round.seq + 1 });
  const props = { words: round.words, onExit: exit, onAgain: again };
  return (
    <div className="flex min-h-[calc(100dvh-24px)] flex-col">
      {ctx.mode === "blink" ? <Blink key={round.seq} {...props} /> : <Quiz key={round.seq} {...props} mode={ctx.mode} pool={ctx.pool} />}
    </div>
  );
}

function Header({ title, i, n, onExit }: { title: string; i: number; n: number; onExit: () => void }) {
  return (
    <>
      <TopBar back="그만하기" onBack={onExit} right={<span className="tnum text-[15px] font-bold">{Math.min(i + 1, n)} / {n}</span>} />
      <div className="flex flex-col gap-2 pt-1">
        <div className="text-sm font-semibold text-l2">{title}</div>
        <div className="h-1.5 overflow-hidden rounded-[3px] bg-g5"><div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${(i / n) * 100}%` }} /></div>
      </div>
    </>
  );
}

/** 깜빡이: 단어 → 발음 → 뜻 → 다음, 자동 반복 */
function Blink({ words, onExit }: { words: Word[]; onExit: () => void; onAgain: (w: Word[]) => void }) {
  const [i, setI] = useState(0);
  const [show, setShow] = useState(false);
  const [play, setPlay] = useState(true);
  const [slow, setSlow] = useState(false);
  const w = words[i % words.length];
  const gap = slow ? 2600 : 1600;
  useEffect(() => {
    if (!play) return;
    setShow(false);
    speak(w.english);
    const t1 = setTimeout(() => setShow(true), gap);
    const t2 = setTimeout(() => setI((x) => x + 1), gap * 2);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [i, play, gap, w.english]);

  return (
    <>
      <Header title={`깜빡이 · ${Math.floor(i / words.length) + 1}바퀴`} i={i % words.length} n={words.length} onExit={onExit} />
      <button onClick={() => setShow(true)} className="flex flex-1 flex-col items-center justify-center gap-4 border-0 bg-transparent px-2 text-center">
        <div className="text-[40px] font-bold leading-tight tracking-[-0.02em]">{w.english}</div>
        <div className={`flex justify-center transition-opacity duration-300 ${show ? "opacity-100" : "opacity-0"}`}><MeaningChips w={w} /></div>
      </button>
      <div className="grid grid-cols-[1fr_2fr_1fr] gap-2 pb-[max(env(safe-area-inset-bottom),24px)]">
        <button className="btn-secondary" onClick={() => { setI((x) => Math.max(0, x - 1)); }}>이전</button>
        <button className="btn-primary" onClick={() => setPlay(!play)}>{play ? "멈추기" : "계속"}</button>
        <button className="btn-secondary" onClick={() => setI((x) => x + 1)}>다음</button>
        <button className="btn-text col-span-3" onClick={() => setSlow(!slow)}>속도: {slow ? "천천히" : "보통"} (바꾸기)</button>
      </div>
    </>
  );
}

/** 플래시카드·객관식·받아쓰기: 한 바퀴 풀고 결과 */
function Quiz({ mode, words, pool, onExit, onAgain }: { mode: Exclude<Mode, "blink">; words: Word[]; pool: string[]; onExit: () => void; onAgain: (w: Word[]) => void }) {
  const [i, setI] = useState(0);
  const [wrong, setWrong] = useState<Word[]>([]);
  if (i >= words.length)
    return (
      <div className="flex flex-1 flex-col gap-5 pt-2">
        <div className="flex flex-col gap-1.5 pt-10">
          <div className="text-sm font-semibold text-l2">{NAMES[mode]} 완료</div>
          <div className="text-[28px] font-bold">{words.length - wrong.length} / {words.length} 맞혔어요</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-[18px] bg-card px-4 py-1.5">
          {wrong.length ? wrong.map((w) => (
            <div key={w.id} className="flex items-center gap-3 border-b border-bg py-2.5 last:border-0">
              <div className="min-w-0 flex-1"><div className="text-base font-[650]">{w.english}</div><MeaningChips w={w} small /></div>
              <PlayButton text={w.english} />
            </div>
          )) : <div className="py-7 text-center text-base text-l2">모두 맞혔어요</div>}
        </div>
        <div className="flex flex-col gap-2.5 pb-[max(env(safe-area-inset-bottom),24px)]">
          {!!wrong.length && <button className="btn-primary" onClick={() => onAgain(wrong)}>틀린 {wrong.length}개만 다시</button>}
          <button className={wrong.length ? "btn-secondary" : "btn-primary"} onClick={() => onAgain(words)}>처음부터 다시</button>
          <button className="btn-secondary" onClick={onExit}>단어장으로</button>
        </div>
      </div>
    );
  const done = (w: Word, ok: boolean) => {
    record(w.id, ok);
    if (!ok) setWrong((x) => [...x, w]);
    setI(i + 1);
  };
  const Card = mode === "flash" ? Flash : mode === "choice" ? Choice : Spell;
  return (
    <>
      <Header title={NAMES[mode]} i={i} n={words.length} onExit={onExit} />
      <Card key={i} w={words[i]} pool={pool} onDone={done} />
    </>
  );
}

type CardProps = { w: Word; pool: string[]; onDone: (w: Word, ok: boolean) => void };

function Flash({ w, onDone }: CardProps) {
  const [flip, setFlip] = useState(false);
  return (
    <>
      <button onClick={() => { setFlip(!flip); if (!flip) speak(w.english); }} className="my-6 flex flex-1 flex-col items-center justify-center gap-4 rounded-[22px] border-0 bg-card px-5 text-center shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
        <div className="text-[38px] font-bold leading-tight">{w.english}</div>
        {flip ? <MeaningChips w={w} /> : <div className="text-sm text-l3">눌러서 뜻 보기</div>}
      </button>
      <div className="grid grid-cols-2 gap-2.5 pb-[max(env(safe-area-inset-bottom),24px)]">
        <button className="h-[54px] rounded-[14px] border-0 bg-bad-bg text-[17px] font-semibold text-bad-ink" onClick={() => onDone(w, false)}>몰라요</button>
        <button className="h-[54px] rounded-[14px] border-0 bg-good-bg text-[17px] font-semibold text-good-ink" onClick={() => onDone(w, true)}>알아요</button>
      </div>
    </>
  );
}

function Choice({ w, pool, onDone }: CardProps) {
  const [choices] = useState(() => shuffle([w.korean, ...shuffle(pool.filter((k) => k !== w.korean)).slice(0, 3)]));
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => { speak(w.english); }, [w.english]);
  const ok = picked === w.korean;
  return (
    <div className="flex flex-1 flex-col gap-6 pt-9">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="text-[34px] font-bold">{w.english}</div>
        {w.pos && <div className="text-sm text-accent">{w.pos}</div>}
        <PlayButton text={w.english} />
      </div>
      <div className="flex flex-col gap-2.5">
        {choices.map((c) => {
          const cls = !picked ? "border-g5 bg-card" : c === w.korean ? "border-good bg-good-bg" : c === picked ? "border-bad bg-bad-bg" : "border-g5 bg-card text-l3";
          return <button key={c} disabled={!!picked} onClick={() => setPicked(c)} className={`min-h-[56px] rounded-[14px] px-4 py-3 text-left text-[17px] ${cls}`} style={{ borderWidth: 1.5 }}>{c}</button>;
        })}
      </div>
      {picked && <button className="btn-primary" autoFocus onClick={() => onDone(w, ok)}>{ok ? "맞았어요 · 다음" : "다음"}</button>}
    </div>
  );
}

function Spell({ w, onDone }: CardProps) {
  const [typed, setTyped] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { speak(w.english); }, [w.english]);
  return (
    <form className="flex flex-1 flex-col gap-5 pt-9" onSubmit={(e) => { e.preventDefault(); if (ok === null) { if (typed.trim()) setOk(gradeTyped(typed, w.english)); } else onDone(w, ok); }}>
      <div className="flex flex-col items-center gap-3 text-center">
        <button type="button" onClick={() => { speak(w.english); input.current?.focus(); }} className="flex size-20 items-center justify-center rounded-full border-0 bg-card text-2xl text-accent" aria-label="다시 듣기">▶</button>
        <div className="text-sm text-l3">들리는 단어를 영어로 쓰세요 · 힌트</div>
        <MeaningChips w={w} />
      </div>
      <input
        ref={input} value={typed} onChange={(e) => setTyped(e.target.value)} readOnly={ok !== null} placeholder="영어로 입력" autoFocus
        autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
        className={`h-[60px] rounded-[14px] bg-card px-[18px] text-center text-[22px] font-semibold outline-none ${ok === null ? "border-g3" : ok ? "border-good" : "border-bad"}`} style={{ borderWidth: 1.5 }}
      />
      {ok === null ? (
        <div className="flex gap-2.5">
          <button type="button" onClick={() => setOk(false)} className="h-[54px] rounded-[14px] border border-g3 bg-card px-[18px] text-[15px] text-l2">모르겠어요</button>
          <button disabled={!typed.trim()} className="h-[54px] flex-1 rounded-[14px] border-0 bg-accent text-[17px] font-[650] text-white disabled:bg-g4">확인</button>
        </div>
      ) : (
        <>
          <div className={`rounded-[14px] px-4 py-3.5 text-[17px] font-bold ${ok ? "bg-good-bg text-good-ink" : "bg-bad-bg text-bad-ink"}`}>{ok ? "맞았어요" : <>정답은 <span className="text-black">{w.english}</span></>}</div>
          <button className="btn-primary">다음</button>
        </>
      )}
    </form>
  );
}
