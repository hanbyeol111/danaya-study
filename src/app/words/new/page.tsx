"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PhotoButtons, PhotoGrid, PhotoInput } from "@/components/PhotoPicker";
import PhotoCheck, { PhotoStrip } from "@/components/PhotoCheck";
import { useMe } from "@/components/Shell";
import { Spinner, TopBar, useUI } from "@/components/ui";
import { api, supabase, must } from "@/lib/supabase";
import { todayKST } from "@/lib/rules";

type Row = { english: string; korean: string };
const MAX = 5;
const blankRows = (n: number) => Array.from({ length: n }, () => ({ english: "", korean: "" }));

export default function NewWordsPage() {
  const me = useMe();
  const router = useRouter();
  const { toast, ask } = useUI();
  const [step, setStep] = useState<"pick" | "loading" | "check" | "edit">("pick");
  const [photos, setPhotos] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [hasToday, setHasToday] = useState(false);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("word_sets").select("id").eq("study_date", todayKST()).maybeSingle().then(({ data }) => setHasToday(!!data));
  }, []);

  const setRow = (i: number, k: keyof Row, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const bad = (r: Row) => !r.english.trim() || !r.korean.trim();
  const badN = rows.filter(bad).length;
  const canSave = rows.length > 0 && !badN && !saving;

  async function extract() {
    setStep("loading");
    setErr("");
    try {
      const r = await api<{ words: Row[] }>("/api/extract-words", { images: photos });
      setRows(r.words.length ? r.words : blankRows(1));
      setStep(r.words.length ? "check" : "edit");
    } catch (e) {
      setErr((e as Error).message);
      setStep("pick");
    }
  }

  async function save() {
    setSaving(true);
    setErr("");
    try {
      const today = todayKST();
      let ws = must(await supabase.from("word_sets").select("id").eq("study_date", today).maybeSingle());
      if (!setRow) {
        const ins = await supabase.from("word_sets").insert({ study_date: today, created_by: me.id }).select("id").single();
        // 동시에 상대가 만들었으면 그 세트에 덧붙인다
        ws = ins.error ? must(await supabase.from("word_sets").select("id").eq("study_date", today).single()) : ins.data;
      }
      const existing = must(await supabase.from("words").select("english,position").eq("set_id", ws!.id)) as { english: string; position: number }[];
      const seen = new Set(existing.map((w) => w.english.toLowerCase()));
      let pos = Math.max(-1, ...existing.map((w) => w.position));
      const clean = rows.map((r) => ({ english: r.english.trim(), korean: r.korean.trim() }));
      const fresh = clean.filter((r) => !seen.has(r.english.toLowerCase()) && seen.add(r.english.toLowerCase())).map((r) => ({ ...r, set_id: ws!.id, position: ++pos }));
      if (fresh.length) must(await supabase.from("words").insert(fresh));
      const skip = clean.length - fresh.length;
      toast(`단어 ${fresh.length}개를 저장했어요${skip ? ` · 이미 있는 ${skip}개는 건너뜀` : ""}`);
      router.push("/");
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  }

  async function backFromRows() {
    if (await ask("확인을 그만할까요?", "지금까지 고친 내용은 저장되지 않아요.", "그만하기")) router.back();
  }

  if (step === "pick" || step === "loading")
    return (
      <div className="flex min-h-[calc(100dvh-60px)] flex-col gap-[18px]">
        <TopBar back="뒤로" onBack={() => router.back()} />
        <div className="flex flex-col gap-1.5">
          <div className="text-[26px] font-bold">{hasToday ? "오늘 단어장에 추가" : "오늘 단어장 만들기"}</div>
          <div className="text-[15px] leading-normal text-l2">단어장 페이지를 찍으면 단어와 뜻을 읽어 와요.<br />저장 전에 꼭 한 번 확인해 주세요.</div>
        </div>
        {step === "loading" ? <Spinner text="사진에서 단어를 읽는 중이에요" sub="보통 10초 안에 끝나요" /> : (
          <div className="flex flex-1 flex-col gap-3.5">
            {!photos.length ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-[18px] p-6" style={{ border: "1.5px dashed var(--color-g4)" }}>
                <div className="text-[15px] text-l2">사진은 최대 {MAX}장까지 올릴 수 있어요</div>
                <PhotoButtons room={MAX} multiple onAdd={setPhotos} />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between"><div className="text-[15px] font-semibold">고른 사진</div><div className="tnum text-sm text-l2">{photos.length} / {MAX}장</div></div>
                <PhotoGrid photos={photos} alt="단어장 사진" onDel={(i) => setPhotos(photos.filter((_, j) => j !== i))}>
                  {photos.length < MAX && (
                    <PhotoInput multiple room={MAX - photos.length} onAdd={(p) => setPhotos([...photos, ...p])}
                      className="flex aspect-[3/4] items-center justify-center rounded-xl text-sm text-l2" >
                      <span className="flex size-full items-center justify-center rounded-xl" style={{ border: "1.5px dashed var(--color-g4)" }}>+ 더 찍기</span>
                    </PhotoInput>
                  )}
                </PhotoGrid>
                <div className="flex-1" />
                <button className="btn-primary" onClick={extract}>단어 읽어 오기</button>
              </>
            )}
            {err && <div className="text-center text-sm text-bad-ink">{err}</div>}
            <button className="btn-text" onClick={() => { setRows(blankRows(3)); setStep("edit"); }}>사진 없이 직접 입력하기</button>
          </div>
        )}
      </div>
    );

  if (step === "check")
    return (
      <div className="fixed inset-0 mx-auto flex max-w-md flex-col bg-bg px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-[calc(env(safe-area-inset-top)+12px)]">
        <TopBar back="뒤로" onBack={backFromRows} />
        <PhotoCheck
          photos={photos} count={`${rows.length}개`} onYes={save} onFix={() => setStep("edit")}
          yesLabel={saving ? "저장 중…" : `네, 맞아요 · ${hasToday ? "오늘 단어장에 추가" : "저장"}`}
          blockReason={badN ? `뜻을 읽지 못한 단어가 ${badN}개 있어요. 고쳐서 채워 주세요` : err || undefined}
        >
          {rows.map((r, i) => (
            <div key={i} className="flex min-h-12 items-center gap-2.5 border-b border-bg last:border-0">
              <span className="tnum w-5 text-[13px] text-l3">{i + 1}</span>
              <span className="text-base font-[650]">{r.english}</span>
              <span className={`min-w-0 flex-1 text-sm ${r.korean ? "text-l2" : "font-semibold text-bad-ink"}`}>{r.korean || "뜻 없음"}</span>
            </div>
          ))}
        </PhotoCheck>
      </div>
    );

  return (
    <div className="fixed inset-0 mx-auto flex max-w-md flex-col bg-bg pt-[calc(env(safe-area-inset-top)+12px)]">
      <TopBar back="뒤로" onBack={backFromRows} className="px-5" />
      <div className="flex flex-col gap-1.5 px-5 pb-3.5 pt-1">
        <div className="text-2xl font-bold">단어 확인하기 <span className="text-lg font-semibold text-l3">{rows.length}개</span></div>
        <div className="text-sm leading-normal text-l2">사진과 다른 곳이 있으면 고쳐 주세요. 빨간 칸은 비어 있어요.</div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 pb-4">
        <PhotoStrip photos={photos} />
        {rows.map((r, i) => (
          <div key={i} className={`flex items-start gap-2 rounded-[14px] border py-2.5 pl-3 pr-1.5 ${bad(r) ? "border-bad bg-bad-bg" : "border-g5 bg-card"}`}>
            <span className="tnum w-5 pt-3 text-[13px] text-l3">{i + 1}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <input value={r.english} onChange={(e) => setRow(i, "english", e.target.value)} placeholder="영어 단어" autoCapitalize="off"
                className="h-11 rounded-[10px] border border-g3 bg-card px-3 text-base font-semibold outline-none focus:border-accent" />
              <input value={r.korean} onChange={(e) => setRow(i, "korean", e.target.value)} placeholder="뜻 (사진에 없으면 직접 적기)"
                className={`h-11 rounded-[10px] border bg-card px-3 text-[15px] outline-none focus:border-accent ${r.korean.trim() ? "border-g3" : "border-bad"}`} />
            </div>
            <button onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`${i + 1}번 줄 지우기`} className="size-11 border-0 bg-transparent text-[15px] text-l3">✕</button>
          </div>
        ))}
        <button className="btn-dashed shrink-0" onClick={() => setRows([...rows, { english: "", korean: "" }])}>+ 줄 추가</button>
      </div>
      <div className="flex flex-col gap-2 border-t border-g5 bg-bg px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-3">
        {badN > 0 && <div className="text-center text-sm text-bad-ink">빈 칸 {badN}개를 채우면 저장할 수 있어요</div>}
        {err && <div className="text-center text-sm text-bad-ink">{err}</div>}
        <button className="btn-primary" disabled={!canSave} onClick={save}>
          {saving ? "저장 중…" : canSave ? (hasToday ? "오늘 단어장에 추가" : "저장") : rows.length ? "빈 칸을 채워야 저장할 수 있어요" : "단어를 추가해 주세요"}
        </button>
      </div>
    </div>
  );
}
