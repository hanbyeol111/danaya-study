"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PhotoPicker from "@/components/PhotoPicker";
import { supabase, must } from "@/lib/supabase";
import { addDays, distributeUnits, todayKST } from "@/lib/rules";
import { fmtDate } from "@/lib/browser";

type Item = { title: string; page: number | null };

export default function NewPlanPage() {
  const router = useRouter();
  const today = todayKST();
  const [book, setBook] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // 기본 종료일: 시험 7일 전 (가정 A7)
    supabase.from("settings").select("exam_date").eq("id", 1).single().then(({ data }) => data && setEnd(addDays(data.exam_date, -7)));
  }, []);

  const set = (i: number, v: Partial<Item>) => setItems(items!.map((x, j) => (j === i ? { ...x, ...v } : x)));
  const move = (i: number, d: number) => {
    const a = [...items!];
    [a[i], a[i + d]] = [a[i + d], a[i]];
    setItems(a);
  };
  const valid = !!items && items.length > 0 && items.every((x) => x.title.trim()) && !!book.trim() && !!end && end >= start;
  const dates = valid ? distributeUnits(items!.length, start, end) : [];
  const days = valid ? Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1 : 0;

  async function save() {
    setSaving(true);
    setErr("");
    try {
      const plan = must(await supabase.from("book_plans").insert({ book_title: book.trim(), start_date: start, end_date: end }).select("id").single());
      must(await supabase.from("book_units").insert(items!.map((x, i) => ({
        plan_id: plan!.id, position: i, title: x.title.trim().slice(0, 40), page: x.page, scheduled_date: dates[i],
      }))));
      router.push("/book");
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="h1">새 책 계획</h1>
      <input className="input" maxLength={30} placeholder="책 이름 (예: RC 교재)" value={book} onChange={(e) => setBook(e.target.value)} />
      {!items ? (
        <>
          <p className="text-sm text-muted">목차 페이지를 찍으면 Day·Unit 항목을 읽어서 시험 전까지 매일 나눠 줘요. 사진은 저장하지 않아요.</p>
          <PhotoPicker<{ items: Item[] }> endpoint="/api/extract-toc" max={5} label="📷 목차 사진 찍기/고르기" onResult={(r) => setItems(r.items.length ? r.items : [{ title: "", page: null }])} />
          <button className="btn" onClick={() => setItems([{ title: "", page: null }])}>✍️ 목차 직접 입력</button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">목차가 맞게 읽혔는지 확인하고 고쳐 주세요. 항목 하나가 하루 공부 단위예요.</p>
          {items.map((x, i) => (
            <div key={i} className={`card flex items-center gap-2 p-2 ${x.title.trim() ? "" : "border-bad"}`}>
              <div className="flex shrink-0 flex-col">
                <button className="px-1 text-xs text-muted disabled:opacity-20" disabled={i === 0} onClick={() => move(i, -1)} aria-label="위로">▲</button>
                <button className="px-1 text-xs text-muted disabled:opacity-20" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="아래로">▼</button>
              </div>
              <input className="input py-2" maxLength={40} value={x.title} placeholder="항목 이름" onChange={(e) => set(i, { title: e.target.value })} />
              <input
                className="input w-16 shrink-0 px-2 py-2 text-center" inputMode="numeric" placeholder="쪽" value={x.page ?? ""}
                onChange={(e) => set(i, { page: e.target.value ? Number(e.target.value.replace(/\D/g, "")) || null : null })}
              />
              <button className="shrink-0 px-1 text-muted" aria-label="삭제" onClick={() => setItems(items.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button className="btn" onClick={() => setItems([...items, { title: "", page: null }])}>+ 항목 추가</button>
          <div className="card grid grid-cols-2 gap-2">
            <label className="text-sm text-muted">시작일<input type="date" className="input mt-1" value={start} onChange={(e) => setStart(e.target.value)} /></label>
            <label className="text-sm text-muted">종료일<input type="date" className="input mt-1" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          </div>
          {end && end < start && <p className="text-sm text-bad">종료일이 시작일보다 빨라요</p>}
          {valid && (
            <p className="text-center text-sm">
              {items.length}개를 {days}일에 나눠서 <b>하루 약 {(items.length / days).toFixed(items.length % days ? 1 : 0)}개</b>, <b>{fmtDate(dates[dates.length - 1])}</b>에 끝나요
            </p>
          )}
          {err && <p className="text-sm text-bad">{err}</p>}
          <button className="btn-primary" disabled={!valid || saving} onClick={save}>{saving ? "만드는 중…" : "계획 만들기"}</button>
        </>
      )}
    </div>
  );
}
