"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PhotoGrid, PhotoInput } from "@/components/PhotoPicker";
import PhotoCheck, { PhotoStrip } from "@/components/PhotoCheck";
import { Spinner, TopBar, useUI } from "@/components/ui";
import { api, supabase, must } from "@/lib/supabase";
import { addDays, daysBetween, distributeUnits, todayKST } from "@/lib/rules";
import { fmtDate } from "@/lib/browser";

type Item = { title: string; page: number | null };
const MAX = 5;

export default function NewPlanPage() {
  const router = useRouter();
  const { toast, ask } = useUI();
  const today = todayKST();
  const [step, setStep] = useState<"info" | "loading" | "check" | "toc">("info");
  const [book, setBook] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // 기본 종료일: 시험 7일 전 (가정 A7)
    supabase.from("settings").select("exam_date").eq("id", 1).single().then(({ data }) => data && setEnd(addDays(data.exam_date, -7)));
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
  const dates = n && days ? distributeUnits(n, start, end) : [];
  const preview = n && days ? `${n >= days ? `하루 약 ${Math.round((n / days) * 10) / 10}개` : `약 ${Math.round((days / n) * 10) / 10}일에 1개`}, ${fmtDate(dates[n - 1])}에 끝나요` : "";

  async function extract() {
    if (!photos.length || !book.trim()) return;
    setStep("loading");
    setErr("");
    try {
      const r = await api<{ items: Item[] }>("/api/extract-toc", { images: photos });
      setItems(r.items.length ? r.items : [{ title: "", page: null }]);
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
              <div className="text-[15px] leading-normal text-l2">목차를 찍으면 Day·Unit 단위로 읽어 와서<br />시험 전까지 날짜별로 나눠 드려요.</div>
            </div>
            <label className="flex flex-col gap-1.5 text-sm text-l2">
              책 이름
              <input value={book} onChange={(e) => setBook(e.target.value.slice(0, 30))} placeholder="예: RC 교재, 단어책" className="field-lg" />
            </label>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm text-l2"><span>목차 사진</span><span className="tnum">{photos.length} / {MAX}장</span></div>
              <PhotoGrid photos={photos} alt="목차 사진" onDel={(i) => setPhotos(photos.filter((_, j) => j !== i))}>
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
            <button className="btn-primary" disabled={!photos.length || !book.trim()} onClick={extract}>목차 읽어 오기</button>
            <button
              className="btn-text -mt-2 h-11"
              onClick={() => { if (!book.trim()) return toast("책 이름을 먼저 적어 주세요"); setItems([{ title: "", page: null }, { title: "", page: null }, { title: "", page: null }]); setStep("toc"); }}
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
              <span className="tnum w-5 text-[13px] text-l3">{i + 1}</span>
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
        <div className="text-2xl font-bold">목차 확인 <span className="text-lg font-semibold text-l3">{n}개</span></div>
        <div className="text-sm text-l2">{book} · 하루에 공부할 단위만 남겨 주세요</div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 pb-4">
        <PhotoStrip photos={photos} />
        {items.map((x, i) => (
          <div key={i} className="flex items-center gap-1.5 rounded-[14px] bg-card py-2 pl-2 pr-1">
            <div className="flex flex-col">
              <button onClick={() => i > 0 && move(i, -1)} aria-label="위로" className={`h-6 w-8 border-0 bg-transparent text-[11px] ${i ? "text-l4" : "text-g4"}`}>▲</button>
              <button onClick={() => i < n - 1 && move(i, 1)} aria-label="아래로" className={`h-6 w-8 border-0 bg-transparent text-[11px] ${i < n - 1 ? "text-l4" : "text-g4"}`}>▼</button>
            </div>
            <input value={x.title} onChange={(e) => set(i, { title: e.target.value.slice(0, 40) })} placeholder="예: Day 1 명사"
              className={`h-11 min-w-0 flex-1 rounded-[10px] border px-2.5 text-[15px] outline-none focus:border-accent ${x.title.trim() ? "border-g3" : "border-bad"}`} />
            <input value={x.page ?? ""} inputMode="numeric" placeholder="쪽" onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); set(i, { page: v ? Number(v) : null }); }}
              className="h-11 w-[52px] rounded-[10px] border border-g3 px-1.5 text-center text-sm outline-none focus:border-accent" />
            <button onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="삭제" className="h-11 w-9 border-0 bg-transparent text-sm text-l3">✕</button>
          </div>
        ))}
        <button className="btn-dashed h-12 shrink-0" onClick={() => setItems([...items, { title: "", page: null }])}>+ 항목 추가</button>
      </div>
      <div className="flex flex-col gap-2.5 border-t border-g5 bg-bg px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[13px] text-l2">시작일<input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-11 rounded-[10px] border border-g3 bg-card px-2 text-[15px] outline-none" /></label>
          <label className="flex flex-col gap-1 text-[13px] text-l2">종료일<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-11 rounded-[10px] border border-g3 bg-card px-2 text-[15px] outline-none" /></label>
        </div>
        {dateErr && <div className="text-sm text-bad-ink">종료일이 시작일보다 빨라요</div>}
        {preview && <div className="text-[15px] font-semibold">{preview}</div>}
        {err && <div className="text-sm text-bad-ink">{err}</div>}
        <button className="btn-primary" disabled={!ok || saving} onClick={create}>{saving ? "만드는 중…" : "계획 만들기"}</button>
      </div>
    </div>
  );
}
