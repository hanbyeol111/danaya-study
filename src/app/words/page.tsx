"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useMe } from "@/components/Shell";
import SpeakButton from "@/components/SpeakButton";
import { supabase, must } from "@/lib/supabase";
import { fmtDate } from "@/lib/browser";
import type { Word } from "@/lib/day";

type WordSet = { id: string; study_date: string; words: Word[] };

export default function WordsPage() {
  const me = useMe();
  const [sets, setSets] = useState<WordSet[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<"sets" | "wrong">("sets");
  const [wrong, setWrong] = useState<{ word: Word; n: number }[]>([]);

  const load = useCallback(async () => {
    const data = must(await supabase.from("word_sets").select("id,study_date,words(id,set_id,english,korean,position)").order("study_date", { ascending: false })) as WordSet[];
    data.forEach((s) => s.words.sort((a, b) => a.position - b.position));
    setSets(data);
    const att = must(await supabase.from("attempts").select("word_id").eq("user_id", me.id).eq("correct", false)) as { word_id: string }[];
    const count = new Map<string, number>();
    att.forEach((a) => count.set(a.word_id, (count.get(a.word_id) ?? 0) + 1));
    const all = new Map(data.flatMap((s) => s.words).map((w) => [w.id, w]));
    setWrong([...count].filter(([id]) => all.has(id)).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([id, n]) => ({ word: all.get(id)!, n })));
  }, [me.id]);

  useEffect(() => { load(); }, [load]);

  if (!sets) return <p className="p-8 text-center text-muted">불러오는 중…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">단어장</h1>
        <Link href="/words/new" className="btn">+ 오늘 단어 추가</Link>
      </div>
      <div className="flex gap-2">
        <button className={`btn flex-1 ${tab === "sets" ? "border-accent text-accent" : ""}`} onClick={() => setTab("sets")}>날짜별</button>
        <button className={`btn flex-1 ${tab === "wrong" ? "border-accent text-accent" : ""}`} onClick={() => setTab("wrong")}>내가 자주 틀리는 단어</button>
      </div>

      {tab === "wrong" ? (
        <div className="card flex flex-col divide-y divide-line p-0">
          {wrong.length === 0 && <p className="p-4 text-sm text-muted">아직 틀린 단어가 없어요</p>}
          {wrong.map(({ word, n }) => (
            <div key={word.id} className="flex items-center gap-2 p-3">
              <SpeakButton text={word.english} />
              <div className="min-w-0 flex-1"><b>{word.english}</b> <span className="text-sm text-muted">{word.korean}</span></div>
              <span className="shrink-0 text-sm text-bad">{n}회</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sets.length === 0 && <p className="text-sm text-muted">아직 단어장이 없어요</p>}
          {sets.map((s) => (
            <div key={s.id} className="card p-0">
              <button className="flex w-full items-center justify-between p-4" onClick={() => setOpen(open === s.id ? null : s.id)}>
                <span className="font-bold">{fmtDate(s.study_date)}</span>
                <span className="text-sm text-muted">단어 {s.words.length}개 {open === s.id ? "▲" : "▼"}</span>
              </button>
              {open === s.id && (
                <div className="flex flex-col divide-y divide-line border-t border-line">
                  {s.words.map((w) => <WordRow key={w.id} w={w} reload={load} />)}
                  <div className="p-3">
                    <button
                      className="btn-danger"
                      onClick={async () => {
                        if (!confirm(`${fmtDate(s.study_date)} 단어장을 지울까요? 이 단어들의 풀이 기록과 복습도 함께 사라져요.`)) return;
                        await supabase.from("word_sets").delete().eq("id", s.id);
                        load();
                      }}
                    >
                      단어장 삭제
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WordRow({ w, reload }: { w: Word; reload: () => void }) {
  const [edit, setEdit] = useState(false);
  const [en, setEn] = useState(w.english);
  const [ko, setKo] = useState(w.korean);
  if (edit)
    return (
      <div className="flex flex-col gap-2 p-3">
        <input className="input" value={en} onChange={(e) => setEn(e.target.value)} autoCapitalize="off" />
        <input className="input" value={ko} onChange={(e) => setKo(e.target.value)} />
        <div className="flex gap-2">
          <button
            className="btn" disabled={!en.trim() || !ko.trim()}
            onClick={async () => { await supabase.from("words").update({ english: en.trim(), korean: ko.trim() }).eq("id", w.id); setEdit(false); reload(); }}
          >저장</button>
          <button className="btn" onClick={() => setEdit(false)}>취소</button>
          <button
            className="btn-danger ml-auto"
            onClick={async () => { if (confirm(`"${w.english}"를 지울까요?`)) { await supabase.from("words").delete().eq("id", w.id); reload(); } }}
          >삭제</button>
        </div>
      </div>
    );
  return (
    <div className="flex items-center gap-2 p-3">
      <SpeakButton text={w.english} />
      <div className="min-w-0 flex-1"><b>{w.english}</b> <span className="text-sm text-muted">{w.korean}</span></div>
      <button className="shrink-0 text-sm text-muted" onClick={() => setEdit(true)}>수정</button>
    </div>
  );
}
