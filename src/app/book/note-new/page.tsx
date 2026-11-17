"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PhotoPicker from "@/components/PhotoPicker";
import { supabase } from "@/lib/supabase";

type Q = { part: number | null; question: string; choices: string[] };

export default function NewNotePage() {
  const router = useRouter();
  const [q, setQ] = useState<Q | null>(null);
  const [mine, setMine] = useState("");
  const [answer, setAnswer] = useState("");
  const [source, setSource] = useState("");
  const [memo, setMemo] = useState("");
  const [err, setErr] = useState("");

  if (!q)
    return (
      <div className="flex flex-col gap-3">
        <h1 className="h1">틀린 문제 추가</h1>
        <p className="text-sm text-muted">틀린 문제를 찍으면 문제와 보기를 옮겨 줘요. 정답은 책 해설을 보고 직접 넣어 주세요. 사진은 저장하지 않아요.</p>
        <PhotoPicker<Q> endpoint="/api/extract-question" max={1} label="📷 문제 사진 찍기/고르기" onResult={setQ} />
        <button className="btn" onClick={() => setQ({ part: null, question: "", choices: [] })}>✍️ 직접 입력 (LC 등)</button>
      </div>
    );

  const valid = answer.trim().length > 0;
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const { error } = await supabase.from("wrong_notes").insert({
          part: q.part, question: q.question.trim(), choices: q.choices.map((c) => c.trim()).filter(Boolean),
          my_answer: mine.trim(), correct_answer: answer.trim(), source: source.trim(), memo: memo.trim(),
        });
        if (error) setErr(error.message);
        else router.push("/book?tab=notes");
      }}
    >
      <h1 className="h1">확인하고 저장</h1>
      <label className="text-sm text-muted">Part
        <select className="input mt-1" value={q.part ?? ""} onChange={(e) => setQ({ ...q, part: e.target.value ? Number(e.target.value) : null })}>
          <option value="">모름</option>
          {[1, 2, 3, 4, 5, 6, 7].map((p) => <option key={p} value={p}>Part {p}</option>)}
        </select>
      </label>
      <label className="text-sm text-muted">문제
        <textarea className="input mt-1 min-h-28" value={q.question} onChange={(e) => setQ({ ...q, question: e.target.value })} />
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-muted">보기</span>
        {q.choices.map((c, i) => (
          <div key={i} className="flex gap-2">
            <input className="input py-2" value={c} onChange={(e) => setQ({ ...q, choices: q.choices.map((x, j) => (j === i ? e.target.value : x)) })} />
            <button type="button" className="btn shrink-0" onClick={() => setQ({ ...q, choices: q.choices.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => setQ({ ...q, choices: [...q.choices, ""] })}>+ 보기 추가</button>
      </div>
      {q.choices.filter(Boolean).length > 0 ? (
        <>
          <label className="text-sm text-muted">내가 고른 답
            <select className="input mt-1" value={mine} onChange={(e) => setMine(e.target.value)}>
              <option value="">선택</option>
              {q.choices.filter(Boolean).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="text-sm text-muted">정답 (필수)
            <select className={`input mt-1 ${valid ? "" : "border-bad"}`} value={answer} onChange={(e) => setAnswer(e.target.value)}>
              <option value="">선택</option>
              {q.choices.filter(Boolean).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </>
      ) : (
        <>
          <label className="text-sm text-muted">내 답<input className="input mt-1" value={mine} onChange={(e) => setMine(e.target.value)} /></label>
          <label className="text-sm text-muted">정답 (필수)<input className={`input mt-1 ${valid ? "" : "border-bad"}`} value={answer} onChange={(e) => setAnswer(e.target.value)} /></label>
        </>
      )}
      <label className="text-sm text-muted">출처 (선택)<input className="input mt-1" placeholder="예: RC 교재 Day 5 #132" value={source} onChange={(e) => setSource(e.target.value)} /></label>
      <label className="text-sm text-muted">왜 틀렸나요? (선택)<input className="input mt-1" value={memo} onChange={(e) => setMemo(e.target.value)} /></label>
      {err && <p className="text-sm text-bad">{err}</p>}
      <button className="btn-primary" disabled={!valid}>저장</button>
    </form>
  );
}
