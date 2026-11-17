"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PhotoGrid, PhotoInput } from "@/components/PhotoPicker";
import PhotoCheck, { PhotoStrip } from "@/components/PhotoCheck";
import { Segment, Spinner, TopBar, useUI } from "@/components/ui";
import { api, supabase, must } from "@/lib/supabase";
import { addDays, daysBetween, distributeByDay, todayKST } from "@/lib/rules";
import { fmtDate } from "@/lib/browser";

type Item = { title: string; page: number | null; day: number | null };
const blank = (day: number | null = null): Item => ({ title: "", page: null, day });
const MAX = 5;

export default function NewPlanPage() {
  const router = useRouter();
  const { toast, ask } = useUI();
  const today = todayKST();
  const [step, setStep] = useState<"info" | "loading" | "check" | "toc">("info");
  const [mode, setMode] = useState<"toc" | "plan">("toc");
  const [examEnd, setExamEnd] = useState("");
  const [book, setBook] = useState("");
  // 목차 사진과 학습 플랜 사진은 따로 보관한다
  const [shots, setShots] = useState<Record<"toc" | "plan", string[]>>({ toc: [], plan: [] });
  const photos = shots[mode];
  const setPhotos = (p: string[]) => setShots((s) => ({ ...s, [mode]: p }));
  const [items, setItems] = useState<Item[]>([]);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // 기본 종료일: 시험 7일 전 (가정 A7)
    supabase.from("settings").select("exam_date").eq("id", 1).single().then(({ data }) => {
      if (data) { setEnd(addDays(data.exam_date, -7)); setExamEnd(addDays(data.exam_date, -7)); }
    });
  }, []);

  const set = (i: number, v: Partial<Item>) => setItems(items.map((x, j) => (j === i ? { ...x, ...v } : x)));
  const move = (i: number, d: number) => {
    const a = [...items];
    [a[i], a[i + d]] = [a[i + d], a[i]];
    setItems(a);
  };
  const n = items.length;
  const dateErr = !!end && end < start;
  const days = start && end && !dateErr ? daysBetween(start, end) + 1 : 0;
  const ok = !!book.trim() && n > 0 && items.every((x) => x.title.trim()) && days > 0;
  const dates = n && days ? distributeByDay(items.map((x) => x.day), start, end) : [];
  const groups = new Set(items.map((x, i) => (x.day == null ? `i${i}` : `d${x.day}`))).size;
  const unit = mode === "plan" ? "플랜 하루치" : "개";
  const preview = n && days ? `${groups >= days ? `하루 약 ${Math.round((groups / days) * 10) / 10}${unit}` : `약 ${Math.round((days / groups) * 10) / 10}일에 ${mode === "plan" ? "플랜 하루치" : "1개"}`}, ${fmtDate(dates[n - 1])}에 끝나요` : "";
  const maxDay = Math.max(0, ...items.map((x) => x.day ?? 0));

  async function extract() {
    if (!photos.length || !book.trim()) return;
    setStep("loading");
    setErr("");
    try {
      const r = await api<{ items: Item[] }>("/api/extract-toc", { images: photos, mode });
      setItems(r.items.length ? r.items.map((x) => ({ ...x, day: mode === "plan" ? x.day : null })) : [blank(mode === "plan" ? 1 : null)]);
      if (mode === "plan" && r.items.length) {
        const last = Math.max(...r.items.map((x) => x.day ?? 0));
        // 책 플랜 속도 그대로가 시험 1주 전보다 빨리 끝나면 그대로, 아니면 시험 1주 전까지
        if (last > 0 && examEnd && addDays(start, last - 1) < examEnd) setEnd(addDays(start, last - 1));
      }
      setStep(r.items.length ? "check" : "toc");
    } catch (e) {
      setErr((e as Error).message);
      setStep("info");
    }
  }

  async function create() {
    if (!ok) return;
    setSaving(true);
    try {
      const plan = must(await supabase.from("book_plans").insert({ book_title: book.trim(), start_date: start, end_date: end }).select("id").single());
      must(await supabase.from("book_units").insert(items.map((x, i) => ({ plan_id: plan!.id, position: i, title: x.title.trim().slice(0, 40), page: x.page, scheduled_date: dates[i] }))));
      toast("계획을 만들었어요");
      router.push(`/book?plan=${plan!.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  }

  async function backFromToc() {
    if (await ask("계획 만들기를 그만할까요?", "읽어 온 목차는 저장되지 않아요.", "그만하기")) router.back();
  }

  if (step === "info" || step === "loading")
    return (
      <div className="flex min-h-[calc(100dvh-60px)] flex-col gap-[18px]">
        <TopBar back="뒤로" onBack={() => router.back()} />
        {step === "loading" ? <Spinner text="목차를 읽는 중이에요" /> : (
          <>
            <div className="flex flex-col gap-1.5">
              <div className="text-[26px] font-bold">새 책 계획</div>
              <div className="text-[15px] leading-normal text-l2">{mode === "toc" ? <>목차를 찍으면 Day·Unit 단위로 읽어 와서<br />시험 전까지 날짜별로 나눠 드려요.</> : <>책 앞쪽 &lsquo;해커스 학습 플랜&rsquo; 표를 찍으면<br />플랜의 하루치를 그대로 날짜에 옮겨요.</>}</div>
            </div>
            <Segment value={mode} options={[["toc", "목차 사진"], ["plan", "학습 플랜 사진"]]} onChange={setMode} />
            {mode === "plan" && <div className="-mt-2 text-[13px] leading-normal text-l3">LISTENING은 p.22, READING은 책 앞쪽 학습 플랜 쪽이에요. 플랜 A·B 중 쓸 것 하나만 크게 찍어 주세요.</div>}
            <label className="flex flex-col gap-1.5 text-sm text-l2">
              책 이름
              <input value={book} onChange={(e) => setBook(e.target.value.slice(0, 30))} placeholder="예: RC 교재, 단어책" className="field-lg" />
            </label>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm text-l2"><span>{mode === "toc" ? "목차 사진" : "학습 플랜 사진"}</span><span className="tnum">{photos.length} / {MAX}장</span></div>
              <PhotoGrid photos={photos} alt={mode === "toc" ? "목차 사진" : "학습 플랜 사진"} onDel={(i) => setPhotos(photos.filter((_, j) => j !== i))}>
                {photos.length < MAX && (
                  <PhotoInput multiple room={MAX - photos.length} onAdd={(p) => setPhotos([...photos, ...p])} className="flex aspect-[3/4]">
                    <span className="flex size-full items-center justify-center rounded-xl text-center text-sm leading-normal text-l2" style={{ border: "1.5px dashed var(--color-g4)" }}>+ 찍기<br />/ 고르기</span>
                  </PhotoInput>
                )}
              </PhotoGrid>
            </div>
            <div className="flex-1" />
            {err && <div className="text-center text-sm text-bad-ink">{err}</div>}
            {!book.trim() && <div className="text-center text-[13px] text-l3">책 이름을 적고 목차 사진을 올려 주세요</div>}
            <button className="btn-primary" disabled={!photos.length || !book.trim()} onClick={extract}>{mode === "toc" ? "목차 읽어 오기" : "학습 플랜 읽어 오기"}</button>
            <button
              className="btn-text -mt-2 h-11"
              onClick={() => { if (!book.trim()) return toast("책 이름을 먼저 적어 주세요"); setItems(mode === "plan" ? [blank(1), blank(2), blank(3)] : [blank(), blank(), blank()]); setStep("toc"); }}
            >사진 없이 목차 직접 입력하기</button>
          </>
        )}
      </div>
    );

  if (step === "check")
    return (
      <div className="fixed inset-0 mx-auto flex max-w-md flex-col bg-bg px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-[calc(env(safe-area-inset-top)+12px)]">
        <TopBar back="뒤로" onBack={backFromToc} />
        <PhotoCheck photos={photos} count={`${n}개`} onYes={() => setStep("toc")} onFix={() => setStep("toc")} yesLabel="네, 맞아요 · 날짜 정하기">
          {items.map((x, i) => (
            <div key={i} className="flex min-h-12 items-center gap-2.5 border-b border-bg last:border-0">
              <span className="tnum w-7 text-[13px] text-l3">{x.day ? `${x.day}일` : i + 1}</span>
              <span className="min-w-0 flex-1 text-[15px]">{x.title}</span>
              <span className="text-xs text-l3">{x.page ? `p.${x.page}` : ""}</span>
            </div>
          ))}
        </PhotoCheck>
      </div>
    );

  return (
    <div className="fixed inset-0 mx-auto flex max-w-md flex-col bg-bg pt-[calc(env(safe-area-inset-top)+12px)]">
      <TopBar back="뒤로" onBack={backFromToc} className="px-5" />
      <div className="flex flex-col gap-1 px-5 pb-3 pt-1">
        <div className="text-2xl font-bold">{mode === "plan" ? "플랜 확인" : "목차 확인"} <span className="text-lg font-semibold text-l3">{n}개</span></div>
        <div className="text-sm text-l2">{book} · {mode === "plan" ? "왼쪽 숫자는 플랜의 몇째 날이에요" : "하루에 공부할 단위만 남겨 주세요"}</div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 pb-4">
        <PhotoStrip photos={photos} />
        {items.map((x, i) => (
          <div key={i} className="flex items-center gap-1.5 rounded-[14px] bg-card py-2 pl-2 pr-1">
            <div className="flex flex-col">
              <button onClick={() => i > 0 && move(i, -1)} aria-label="위로" className={`h-6 w-8 border-0 bg-transparent text-[11px] ${i ? "text-l4" : "text-g4"}`}>▲</button>
              <button onClick={() => i < n - 1 && move(i, 1)} aria-label="아래로" className={`h-6 w-8 border-0 bg-transparent text-[11px] ${i < n - 1 ? "text-l4" : "text-g4"}`}>▼</button>
            </div>
            {x.day != null && (
              <input value={x.day} inputMode="numeric" aria-label="플랜 몇째 날" onChange={(e) => { const v = Number(e.target.value.replace(/\D/g, "")); set(i, { day: v || null }); }}
                className="h-11 w-10 rounded-[10px] border border-g3 px-1 text-center text-[13px] text-l2 outline-none focus:border-accent" />
            )}
            <input value={x.title} onChange={(e) => set(i, { title: e.target.value.slice(0, 40) })} placeholder={mode === "plan" ? "예: Part 1 Course 1-1" : "예: Day 1 명사"}
              className={`h-11 min-w-0 flex-1 rounded-[10px] border px-2.5 text-[15px] outline-none focus:border-accent ${x.title.trim() ? "border-g3" : "border-bad"}`} />
            <input value={x.page ?? ""} inputMode="numeric" placeholder="쪽" onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); set(i, { page: v ? Number(v) : null }); }}
              className="h-11 w-[52px] rounded-[10px] border border-g3 px-1.5 text-center text-sm outline-none focus:border-accent" />
            <button onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="삭제" className="h-11 w-9 border-0 bg-transparent text-sm text-l3">✕</button>
          </div>
        ))}
        <button className="btn-dashed h-12 shrink-0" onClick={() => setItems([...items, blank(mode === "plan" ? maxDay + 1 : null)])}>+ 항목 추가</button>
      </div>
      <div className="flex flex-col gap-2.5 border-t border-g5 bg-bg px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[13px] text-l2">시작일<input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-11 rounded-[10px] border border-g3 bg-card px-2 text-[15px] outline-none" /></label>
          <label className="flex flex-col gap-1 text-[13px] text-l2">종료일<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-11 rounded-[10px] border border-g3 bg-card px-2 text-[15px] outline-none" /></label>
        </div>
        {mode === "plan" && maxDay > 0 && (
          <div className="flex gap-2">
            <button onClick={() => setEnd(addDays(start, maxDay - 1))} className={`h-9 flex-1 rounded-[10px] border text-[13px] font-semibold ${end === addDays(start, maxDay - 1) ? "border-accent bg-accent text-white" : "border-g3 bg-card text-l4"}`}>책 플랜 그대로 ({maxDay}일)</button>
            {examEnd && <button onClick={() => setEnd(examEnd)} className={`h-9 flex-1 rounded-[10px] border text-[13px] font-semibold ${end === examEnd ? "border-accent bg-accent text-white" : "border-g3 bg-card text-l4"}`}>시험 1주 전까지 늘리기</button>}
          </div>
        )}
        {dateErr && <div className="text-sm text-bad-ink">종료일이 시작일보다 빨라요</div>}
        {preview && <div className="text-[15px] font-semibold">{preview}</div>}
        {err && <div className="text-sm text-bad-ink">{err}</div>}
        <button className="btn-primary" disabled={!ok || saving} onClick={create}>{saving ? "만드는 중…" : "계획 만들기"}</button>
      </div>
    </div>
  );
}
