"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PhotoButtons, PhotoGrid, PhotoInput } from "@/components/PhotoPicker";
import PhotoCheck, { PhotoStrip } from "@/components/PhotoCheck";
import { useMe } from "@/components/Shell";
import { Spinner, TopBar, useUI } from "@/components/ui";
import { api, supabase, must } from "@/lib/supabase";
import { todayKST } from "@/lib/rules";

type Row = { english: string; pos: string; korean: string };
type BookOpt = { id: string; title: string; days: number };
const MAX = 5;
const blankRows = (n: number) => Array.from({ length: n }, () => ({ english: "", pos: "", korean: "" }));

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
  const [books, setBooks] = useState<BookOpt[]>([]);
  const [bookId, setBookId] = useState("new");
  const [newTitle, setNewTitle] = useState("");
  const [dayTitle, setDayTitle] = useState("Day 1");
  const [forToday, setForToday] = useState(true);

  function pickBook(id: string, list: BookOpt[]) {
    setBookId(id);
    setDayTitle(`Day ${(list.find((b) => b.id === id)?.days ?? 0) + 1}`);
  }

  useEffect(() => {
    (async () => {
      const [today, bs] = await Promise.all([
        supabase.from("word_sets").select("id").eq("study_date", todayKST()).maybeSingle(),
        supabase.from("word_books").select("id,title,word_sets(count)").order("created_at", { ascending: false }),
      ]);
      setHasToday(!!today.data);
      setForToday(!today.data);
      const list = ((bs.data ?? []) as unknown as { id: string; title: string; word_sets: { count: number }[] }[])
        .map((b) => ({ id: b.id, title: b.title, days: b.word_sets[0]?.count ?? 0 }));
      setBooks(list);
      const want = new URLSearchParams(window.location.search).get("book");
      const first = list.find((b) => b.id === want) ?? list[0];
      if (first) pickBook(first.id, list);
    })();
  }, []);

  const whereOk = !!dayTitle.trim() && (bookId !== "new" || !!newTitle.trim());

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
      const book = bookId === "new"
        ? must(await supabase.from("word_books").insert({ title: newTitle.trim().slice(0, 30), created_by: me.id }).select("id").single())!
        : { id: bookId };
      const days = books.find((b) => b.id === book.id)?.days ?? 0;
      const base = { book_id: book.id, title: dayTitle.trim().slice(0, 30), position: days, created_by: me.id };
      const want = forToday && !hasToday;
      let ins = await supabase.from("word_sets").insert({ ...base, study_date: want ? todayKST() : null }).select("id").single();
      // 그사이 상대가 오늘 분량을 정했으면 날짜 없이 저장한다
      const late = want && !!ins.error;
      if (late) ins = await supabase.from("word_sets").insert(base).select("id").single();
      const ws = must(ins)!;
      const seen = new Set<string>();
      const fresh = rows
        .map((r) => ({ english: r.english.trim(), pos: r.pos.trim().slice(0, 20), korean: r.korean.trim() }))
        .filter((r) => !seen.has(r.english.toLowerCase()) && seen.add(r.english.toLowerCase()))
        .map((r, i) => ({ ...r, set_id: ws.id, position: i }));
      must(await supabase.from("words").insert(fresh));
      const skip = rows.length - fresh.length;
      toast(`${base.title}에 단어 ${fresh.length}개를 저장했어요${skip ? ` · 겹치는 ${skip}개는 건너뜀` : ""}${late ? " · 오늘 분량은 이미 있어요" : ""}`);
      router.push(want && !late ? "/" : `/words/book?id=${book.id}`);
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
          <div className="text-[26px] font-bold">단어 추가</div>
          <div className="text-[15px] leading-normal text-l2">단어장 페이지를 찍으면 단어와 뜻을 읽어 와요.<br />저장 전에 꼭 한 번 확인해 주세요.</div>
        </div>
        {step === "pick" && (
          <div className="flex flex-col gap-3 rounded-[18px] bg-card p-4">
            <label className="label">
              단어장
              <select value={bookId} onChange={(e) => { if (e.target.value === "new") { setBookId("new"); setDayTitle("Day 1"); } else pickBook(e.target.value, books); }} className="field font-normal">
                {books.map((b) => <option key={b.id} value={b.id}>{b.title} (Day {b.days}개)</option>)}
                <option value="new">+ 새 단어장 만들기</option>
              </select>
            </label>
            {bookId === "new" && <input value={newTitle} onChange={(e) => setNewTitle(e.target.value.slice(0, 30))} placeholder="새 단어장 이름 (예: 해커스 보카)" aria-label="새 단어장 이름" className="field" />}
            <label className="label">
              Day 이름
              <input value={dayTitle} onChange={(e) => setDayTitle(e.target.value.slice(0, 30))} className="field font-normal" />
            </label>
            <label className={`flex min-h-11 items-center gap-2.5 text-[15px] ${hasToday ? "text-l3" : ""}`}>
              <input type="checkbox" checked={forToday && !hasToday} disabled={hasToday} onChange={(e) => setForToday(e.target.checked)} className="size-5 accent-[#007aff]" />
              {hasToday ? "오늘 분량은 이미 있어요 · 단어장에만 저장" : "오늘 공부할 분량으로 정하기"}
            </label>
          </div>
        )}
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
                <button className="btn-primary" disabled={!whereOk} onClick={extract}>{whereOk ? "단어 읽어 오기" : "단어장 이름을 적어 주세요"}</button>
              </>
            )}
            {err && <div className="text-center text-sm text-bad-ink">{err}</div>}
            <button className="btn-text" disabled={!whereOk} onClick={() => { setRows(blankRows(3)); setStep("edit"); }}>사진 없이 직접 입력하기</button>
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
          yesLabel={saving ? "저장 중…" : `네, 맞아요 · ${dayTitle}에 저장`}
          blockReason={badN ? `뜻을 읽지 못한 단어가 ${badN}개 있어요. 고쳐서 채워 주세요` : err || undefined}
        >
          {rows.map((r, i) => (
            <div key={i} className="flex min-h-12 items-center gap-2.5 border-b border-bg last:border-0">
              <span className="tnum w-5 text-[13px] text-l3">{i + 1}</span>
              <span className="text-base font-[650]">{r.english}</span>
              {r.pos && <span className="text-xs text-accent">{r.pos}</span>}
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
              <div className="flex gap-1.5">
                <input value={r.english} onChange={(e) => setRow(i, "english", e.target.value)} placeholder="영어 단어" autoCapitalize="off"
                  className="h-11 min-w-0 flex-1 rounded-[10px] border border-g3 bg-card px-3 text-base font-semibold outline-none focus:border-accent" />
                <input value={r.pos} onChange={(e) => setRow(i, "pos", e.target.value.slice(0, 20))} placeholder="품사" aria-label="품사"
                  className="h-11 w-[72px] rounded-[10px] border border-g3 bg-card px-2.5 text-[15px] outline-none focus:border-accent" />
              </div>
              <input value={r.korean} onChange={(e) => setRow(i, "korean", e.target.value)} placeholder="뜻 (쉼표로 나눠 적기)"
                className={`h-11 rounded-[10px] border bg-card px-3 text-[15px] outline-none focus:border-accent ${r.korean.trim() ? "border-g3" : "border-bad"}`} />
            </div>
            <button onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`${i + 1}번 줄 지우기`} className="size-11 border-0 bg-transparent text-[15px] text-l3">✕</button>
          </div>
        ))}
        <button className="btn-dashed shrink-0" onClick={() => setRows([...rows, { english: "", pos: "", korean: "" }])}>+ 줄 추가</button>
      </div>
      <div className="flex flex-col gap-2 border-t border-g5 bg-bg px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-3">
        {badN > 0 && <div className="text-center text-sm text-bad-ink">빈 칸 {badN}개를 채우면 저장할 수 있어요</div>}
        {err && <div className="text-center text-sm text-bad-ink">{err}</div>}
        <button className="btn-primary" disabled={!canSave} onClick={save}>
          {saving ? "저장 중…" : canSave ? `${dayTitle}에 저장` : rows.length ? "빈 칸을 채워야 저장할 수 있어요" : "단어를 추가해 주세요"}
        </button>
      </div>
    </div>
  );
}
