"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PhotoButtons } from "@/components/PhotoPicker";
import PhotoCheck, { PhotoStrip } from "@/components/PhotoCheck";
import { Chip, Spinner, TopBar, useUI } from "@/components/ui";
import { api, supabase } from "@/lib/supabase";

type Form = { part: number | null; question: string; choices: string[]; my: string; correct: string; source: string; memo: string };
const EMPTY: Form = { part: null, question: "", choices: ["", "", "", ""], my: "", correct: "", source: "", memo: "" };

export default function NewNotePage() {
  const router = useRouter();
  const { toast, ask } = useUI();
  const [step, setStep] = useState<"pick" | "loading" | "check" | "form">("pick");
  const [editId, setEditId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [f, setF] = useState<Form>(EMPTY);
  const [err, setErr] = useState("");
  const set = (patch: Partial<Form>) => setF((x) => ({ ...x, ...patch }));

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("edit");
    if (!id) return;
    supabase.from("wrong_notes").select("*").eq("id", id).single().then(({ data: n }) => {
      if (!n) return;
      setEditId(id);
      setF({ part: n.part, question: n.question, choices: n.choices, my: n.my_answer, correct: n.correct_answer, source: n.source, memo: n.memo });
      setStep("form");
    });
  }, []);

  async function extract(imgs: string[]) {
    setPhotos(imgs);
    setStep("loading");
    setErr("");
    try {
      const r = await api<{ part: number | null; question: string; choices: string[] }>("/api/extract-question", { images: imgs.slice(0, 1) });
      setF({ ...EMPTY, part: r.part, question: r.question, choices: r.choices });
      setStep("check");
    } catch (e) {
      setErr((e as Error).message);
      setStep("pick");
    }
  }

  const filled = f.choices.map((c) => c.trim()).filter(Boolean);
  const ok = !!f.question.trim() && !!f.my.trim() && !!f.correct.trim();

  async function save() {
    if (!ok) return;
    const data = {
      part: f.part, question: f.question.trim(), choices: filled, my_answer: f.my.trim(),
      correct_answer: f.correct.trim(), source: f.source.trim(), memo: f.memo.trim(),
    };
    const { error } = editId ? await supabase.from("wrong_notes").update(data).eq("id", editId) : await supabase.from("wrong_notes").insert(data);
    if (error) return setErr(error.message);
    toast("오답 노트에 저장했어요");
    router.push(editId ? `/book?note=${editId}` : "/book?tab=notes");
  }

  async function back() {
    if (step === "form" && !editId && !(await ask("입력을 그만할까요?", "지금까지 적은 내용은 저장되지 않아요.", "그만하기"))) return;
    router.back();
  }

  if (step === "pick" || step === "loading")
    return (
      <div className="flex min-h-[calc(100dvh-60px)] flex-col gap-[18px]">
        <TopBar back="뒤로" onBack={back} />
        {step === "loading" ? <Spinner text="문제를 읽는 중이에요" /> : (
          <>
            <div className="flex flex-col gap-1.5">
              <div className="text-[26px] font-bold">틀린 문제 추가</div>
              <div className="text-[15px] leading-normal text-l2">문제 사진 1장을 찍으면 지문과 보기를 읽어 와요.<br />정답은 해설을 보고 직접 넣어 주세요.</div>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-3.5 rounded-[18px] p-6" style={{ border: "1.5px dashed var(--color-g4)" }}>
              <PhotoButtons room={1} onAdd={extract} />
              <div className="text-center text-[13px] leading-normal text-l3">LC(Part 1~4)처럼 글자가 거의 없으면<br />직접 입력이 더 빨라요</div>
            </div>
            {err && <div className="text-center text-sm text-bad-ink">{err}</div>}
            <button className="btn-text" onClick={() => { setF(EMPTY); setStep("form"); }}>사진 없이 직접 입력하기</button>
          </>
        )}
      </div>
    );

  if (step === "check")
    return (
      <div className="fixed inset-0 mx-auto flex max-w-md flex-col bg-bg px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-[calc(env(safe-area-inset-top)+12px)]">
        <TopBar back="뒤로" onBack={() => router.back()} />
        <PhotoCheck photos={photos} count={f.part ? `Part ${f.part}` : ""} onYes={() => setStep("form")} onFix={() => setStep("form")} yesLabel="네, 맞아요 · 답 적기">
          <div className="flex flex-col gap-2 py-3">
            <div className="whitespace-pre-wrap text-base leading-normal">{f.question || <span className="text-bad-ink">문제를 읽지 못했어요</span>}</div>
            {f.choices.map((c, i) => <div key={i} className="text-[15px] text-l4">{c}</div>)}
          </div>
        </PhotoCheck>
      </div>
    );

  const ansChips = (k: "my" | "correct") => (
    <div className="flex flex-wrap gap-1.5">
      {filled.map((c) => (
        <button key={c} onClick={() => set({ [k]: c })} className={`min-h-10 rounded-[10px] border px-3 py-1.5 text-left text-sm ${f[k] === c ? "border-accent bg-accent text-white" : "border-g3 bg-card text-black"}`}>{c}</button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 mx-auto flex max-w-md flex-col bg-bg pt-[calc(env(safe-area-inset-top)+12px)]">
      <TopBar back="뒤로" onBack={back} className="px-5" />
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-5 pb-5 pt-1">
        <div className="text-2xl font-bold">{editId ? "오답 노트 수정" : "틀린 문제 확인"}</div>
        <PhotoStrip photos={photos} />
        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold text-l2">Part</div>
          <div className="flex flex-wrap gap-1.5">
            {[null, 1, 2, 3, 4, 5, 6, 7].map((p) => <Chip key={String(p)} on={f.part === p} onClick={() => set({ part: p })}>{p ?? "모름"}</Chip>)}
          </div>
        </div>
        <label className="label">
          문제
          <textarea value={f.question} onChange={(e) => set({ question: e.target.value })} rows={3} placeholder="문제 지문이나 문장"
            className="resize-none rounded-xl border border-g3 bg-card px-3.5 py-3 text-base font-normal leading-normal text-black outline-none focus:border-accent" />
        </label>
        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold text-l2">보기 <span className="font-normal text-l3">(없으면 비워 두세요)</span></div>
          {f.choices.map((c, i) => (
            <div key={i} className="flex gap-1.5">
              <input value={c} placeholder={`(${"ABCD"[i % 4]}) 보기`} onChange={(e) => set({ choices: f.choices.map((x, j) => (j === i ? e.target.value : x)) })} className="field" />
              <button onClick={() => set({ choices: f.choices.filter((_, j) => j !== i) })} aria-label="보기 지우기" className="h-[46px] w-10 border-0 bg-transparent text-sm text-l3">✕</button>
            </div>
          ))}
          <button onClick={() => set({ choices: [...f.choices, ""] })} className="h-[42px] rounded-[10px] bg-transparent text-sm text-l2" style={{ border: "1.5px dashed var(--color-g4)" }}>+ 보기 추가</button>
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold text-l2">내 답 <span className="text-bad-ink">*</span></div>
          {filled.length ? ansChips("my") : <input value={f.my} onChange={(e) => set({ my: e.target.value })} placeholder="내가 고른 답" className="field" />}
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold text-l2">정답 <span className="text-bad-ink">*</span> <span className="font-normal text-l3">해설을 보고 골라 주세요</span></div>
          {filled.length ? ansChips("correct") : <input value={f.correct} onChange={(e) => set({ correct: e.target.value })} placeholder="정답" className="field" />}
        </div>
        <label className="label">
          <span>출처 <span className="font-normal text-l3">선택</span></span>
          <input value={f.source} onChange={(e) => set({ source: e.target.value })} placeholder="예: RC 교재 Day 5 #132" className="field font-normal" />
        </label>
        <label className="label">
          <span>왜 틀렸나 <span className="font-normal text-l3">선택 · 한 줄</span></span>
          <input value={f.memo} onChange={(e) => set({ memo: e.target.value })} placeholder="예: 시제 단서를 놓침" className="field font-normal" />
        </label>
        {err && <div className="text-sm text-bad-ink">{err}</div>}
      </div>
      <div className="border-t border-g5 px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-3">
        <button className="btn-primary text-base" disabled={!ok} onClick={save}>{ok ? "저장" : "문제·내 답·정답을 채워 주세요"}</button>
      </div>
    </div>
  );
}
