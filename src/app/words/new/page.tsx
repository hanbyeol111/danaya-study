"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PhotoPicker from "@/components/PhotoPicker";
import { useMe } from "@/components/Shell";
import { supabase, must } from "@/lib/supabase";
import { todayKST } from "@/lib/rules";

type Row = { english: string; korean: string };

export default function NewWordsPage() {
  const me = useMe();
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (i: number, k: keyof Row, v: string) => setRows(rows!.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const blank = rows?.some((r) => !r.english.trim() || !r.korean.trim()) ?? true;

  async function save() {
    setSaving(true);
    setErr("");
    try {
      const today = todayKST();
      let setRow = must(await supabase.from("word_sets").select("id").eq("study_date", today).maybeSingle());
      if (!setRow) {
        const ins = await supabase.from("word_sets").insert({ study_date: today, created_by: me.id }).select("id").single();
        // 동시에 상대가 만들었으면 그 세트에 덧붙인다
        setRow = ins.error ? must(await supabase.from("word_sets").select("id").eq("study_date", today).single()) : ins.data;
      }
      const existing = must(await supabase.from("words").select("english,position").eq("set_id", setRow!.id)) as { english: string; position: number }[];
      const seen = new Set(existing.map((w) => w.english.toLowerCase()));
      let pos = Math.max(-1, ...existing.map((w) => w.position));
      const fresh = rows!
        .map((r) => ({ english: r.english.trim(), korean: r.korean.trim() }))
        .filter((r) => !seen.has(r.english.toLowerCase()) && seen.add(r.english.toLowerCase()))
        .map((r) => ({ ...r, set_id: setRow!.id, position: ++pos }));
      if (fresh.length) must(await supabase.from("words").insert(fresh));
      router.push("/");
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  }

  if (!rows)
    return (
      <div className="flex flex-col gap-4">
        <h1 className="h1">오늘 단어장 만들기</h1>
        <p className="text-sm text-muted">단어장 페이지를 찍으면 단어와 뜻을 읽어 와요. 저장 전에 꼭 확인하고 고칠 수 있어요. 사진은 저장하지 않아요.</p>
        <PhotoPicker<{ words: Row[] }> endpoint="/api/extract-words" max={5} label="📷 단어장 사진 찍기/고르기" onResult={(r) => setRows(r.words.length ? r.words : [{ english: "", korean: "" }])} />
        <button className="btn" onClick={() => setRows([{ english: "", korean: "" }])}>✍️ 사진 없이 직접 입력</button>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      <h1 className="h1">확인하고 고치기</h1>
      <p className="text-sm text-muted">사진과 다르게 읽힌 곳이 없는지 확인해 주세요. 뜻이 빈 칸은 채워야 저장할 수 있어요. 오늘 단어장이 이미 있으면 거기에 추가돼요.</p>
      {rows.map((r, i) => {
        const empty = !r.korean.trim() || !r.english.trim();
        return (
          <div key={i} className={`card flex flex-col gap-2 p-3 ${empty ? "border-bad bg-bad/5" : ""}`}>
            <div className="flex gap-2">
              <input className="input" placeholder="영어" value={r.english} onChange={(e) => set(i, "english", e.target.value)} autoCapitalize="off" />
              <button className="btn shrink-0" aria-label="행 삭제" onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>
            </div>
            <input className="input" placeholder="뜻 (한국어)" value={r.korean} onChange={(e) => set(i, "korean", e.target.value)} />
          </div>
        );
      })}
      <button className="btn" onClick={() => setRows([...rows, { english: "", korean: "" }])}>+ 행 추가</button>
      {err && <p className="text-sm text-bad">{err}</p>}
      <button className="btn-primary" disabled={blank || saving || rows.length === 0} onClick={save}>
        {saving ? "저장 중…" : `${rows.length}개 저장`}
      </button>
      {blank && rows.length > 0 && <p className="text-center text-sm text-bad">빈 칸이 남아 있어요</p>}
    </div>
  );
}
