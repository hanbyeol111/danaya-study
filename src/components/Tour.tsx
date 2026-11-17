"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 실제 화면 위에 배경을 어둡게 깔고, 설명할 부분만 밝게 뚫어서 흰 말풍선으로 알려주는 둘러보기.
 * 화면마다 처음 한 번만 뜨고(localStorage), 도움말의 "둘러보기 다시 보기"로 다시 볼 수 있다.
 * 대상은 data-tour="이름" 속성으로 찾는다. 화면에 없는 대상(예: 아직 단어장이 없음)은 건너뛴다.
 */
export type TourStep = { at: string; title: string; body: string; example?: string };

const KEY = "tour-done:";
export const resetTours = () => {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(KEY)).forEach((k) => localStorage.removeItem(k));
  } catch {}
};
const isDone = (id: string) => { try { return localStorage.getItem(KEY + id) === "1"; } catch { return true; } };
const markDone = (id: string) => { try { localStorage.setItem(KEY + id, "1"); } catch {} };
const find = (at: string) => document.querySelector<HTMLElement>(`[data-tour="${at}"]`);

export default function Tour({ id, steps }: { id: string; steps: TourStep[] }) {
  const [list, setList] = useState<TourStep[] | null>(null);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // 화면 데이터가 다 그려질 때까지 기다렸다가(첫 대상이 보일 때) 시작
  useEffect(() => {
    if (isDone(id)) return;
    let tries = 0;
    const t = setInterval(() => {
      const ok = steps.filter((s) => find(s.at));
      tries++;
      // 다 보이면 바로, 첫 대상만 보이면 늦게 그려지는 부분을 2초쯤 더 기다린 뒤 시작
      if (ok.length === steps.length || (find(steps[0].at) && tries > 7) || tries > 20) {
        clearInterval(t);
        if (ok.length) setList(ok);
        else markDone(id);
      }
    }, 300);
    return () => clearInterval(t);
  }, [id, steps]);

  const step = list?.[i];
  const measure = useCallback(() => {
    const el = step && find(step.at);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useEffect(() => {
    if (!step) return;
    const el = find(step.at);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [step, measure]);

  if (!list || !step) return null;
  const close = () => { markDone(id); setList(null); };
  const last = i === list.length - 1;
  const pad = 6;
  const below = rect ? rect.bottom + 220 < window.innerHeight || rect.top < 240 : true;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={`화면 안내: ${step.title}`}>
      {/* 밝게 뚫린 부분 + 나머지 어둡게 */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-[16px] transition-all duration-300"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgba(0,0,0,0.68)", outline: "2px solid rgba(255,255,255,0.9)" }}
        />
      ) : <div className="absolute inset-0 bg-black/70" />}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />
      <div
        className="absolute inset-x-4 mx-auto max-w-[380px] rounded-[18px] bg-white px-4 pb-3.5 pt-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] transition-all duration-300"
        style={rect ? (below ? { top: Math.min(rect.bottom + pad + 12, window.innerHeight - 230) } : { bottom: window.innerHeight - rect.top + pad + 12 }) : { top: "35%" }}
      >
        <div className="flex items-center justify-between">
          <span className="tnum text-[13px] font-semibold text-accent">{i + 1} / {list.length}</span>
          <button onClick={close} className="h-8 border-0 bg-transparent px-1 text-[13px] text-l3">건너뛰기</button>
        </div>
        <div className="mt-0.5 text-[18px] font-bold leading-snug">{step.title}</div>
        <div className="mt-1.5 text-[15px] leading-normal text-l4">{step.body}</div>
        {step.example && <div className="mt-2.5 rounded-xl bg-bg px-3 py-2 text-sm leading-normal text-l2"><b className="text-black">예)</b> {step.example}</div>}
        <div className="mt-3.5 flex gap-2">
          {i > 0 && <button onClick={() => setI(i - 1)} className="h-11 rounded-xl border-0 bg-bg px-4 text-[15px] font-semibold">이전</button>}
          <button onClick={() => (last ? close() : setI(i + 1))} className="h-11 flex-1 rounded-xl border-0 bg-accent text-[15px] font-semibold text-white">
            {last ? "알겠어요, 시작!" : "다음"}
          </button>
        </div>
      </div>
    </div>
  );
}
