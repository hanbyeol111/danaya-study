"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { speak } from "@/lib/browser";

/* ---------- 토스트 · 확인 대화상자 (앱 전체 공용) ---------- */

type Ask = (title: string, body: string, label: string) => Promise<boolean>;
const UIContext = createContext<{ toast: (m: string) => void; ask: Ask }>({ toast: () => {}, ask: async () => false });
export const useUI = () => useContext(UIContext);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [toastMsg, setToast] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ title: string; body: string; label: string } | null>(null);
  const resolver = useRef<(ok: boolean) => void>(() => {});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((m: string) => {
    setToast(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2400);
  }, []);
  const ask = useCallback<Ask>((title, body, label) => {
    setDialog({ title, body, label });
    return new Promise((r) => (resolver.current = r));
  }, []);
  const close = (ok: boolean) => {
    setDialog(null);
    resolver.current(ok);
  };

  return (
    <UIContext.Provider value={{ toast, ask }}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-7" role="dialog" aria-modal="true">
          <div className="flex w-full max-w-sm flex-col gap-2.5 rounded-[20px] bg-card px-5 pb-4 pt-6">
            <div className="text-[19px] font-bold">{dialog.title}</div>
            <div className="text-[15px] leading-normal text-l2">{dialog.body}</div>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button className="h-[50px] rounded-xl bg-bg text-base font-semibold" onClick={() => close(false)}>취소</button>
              <button className="h-[50px] rounded-xl bg-accent text-base font-[650] text-white" onClick={() => close(true)} autoFocus>{dialog.label}</button>
            </div>
          </div>
        </div>
      )}
      {toastMsg && (
        <div className="pointer-events-none fixed inset-x-5 bottom-[110px] z-[60] flex justify-center" role="status">
          <div className="rounded-[14px] bg-accent px-[18px] py-[13px] text-center text-[15px] leading-snug text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]">{toastMsg}</div>
        </div>
      )}
    </UIContext.Provider>
  );
}

/* ---------- 화면 조각 ---------- */

/** 탭 바 없이 화면 전체를 덮는 하위 화면 */
export function Sub({ children, pad = true }: { children: React.ReactNode; pad?: boolean }) {
  return (
    <div className={`fixed inset-0 z-10 mx-auto flex max-w-md flex-col bg-bg pt-[calc(env(safe-area-inset-top)+12px)] ${pad ? "px-5 pb-10" : ""}`}>
      {children}
    </div>
  );
}

/** "‹ 뒤로" 같은 상단 줄 */
export function TopBar({ back, onBack, href, right, className = "" }: { back: string; onBack?: () => void; href?: string; right?: React.ReactNode; className?: string }) {
  const cls = "h-11 border-0 bg-transparent pr-3 text-[17px] text-accent";
  return (
    <div className={`flex h-12 shrink-0 items-center ${className}`}>
      {href ? <Link href={href} className={`${cls} flex items-center`}>‹ {back}</Link> : <button className={cls} onClick={onBack}>‹ {back}</button>}
      <div className="flex-1" />
      {right}
    </div>
  );
}

export function Spinner({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[18px] pb-20">
      <div className="size-9 animate-spin rounded-full border-[3px] border-g3 border-t-black" />
      <div className="text-base font-semibold">{text}</div>
      {sub && <div className="text-sm text-l2">{sub}</div>}
    </div>
  );
}

export function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-[3px] bg-track">
      <div className={`h-full rounded-[3px] transition-[width] duration-400 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** 체크 동그라미 */
export function Check({ done, dim }: { done: boolean; dim?: boolean }) {
  return (
    <span
      className={`flex size-[22px] shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${done ? "border-accent bg-accent" : "border-g4"} ${dim ? "opacity-55" : ""}`}
      style={{ borderWidth: 1.5 }}
    >
      ✓
    </span>
  );
}

export const LateBadge = () => <span className="shrink-0 rounded-md bg-bad-bg px-[7px] py-0.5 text-xs font-semibold text-bad-ink">밀림</span>;

export function PlayButton({ text, size = 40 }: { text: string; size?: number }) {
  return (
    <button
      type="button" aria-label={`${text} 발음 듣기`} onClick={() => speak(text)}
      className="shrink-0 rounded-full border-0 bg-bg text-xs text-l4" style={{ width: size, height: size }}
    >
      ▶
    </button>
  );
}

/** 2칸 세그먼트 */
export function Segment<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-g5 p-1">
      {options.map(([v, label]) => (
        <button
          key={v} onClick={() => onChange(v)}
          className={`h-[42px] rounded-[9px] border-0 text-[15px] font-[650] ${value === v ? "bg-card text-black shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "bg-transparent text-l2"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** 둥근 칩 (Part 필터 등) */
export function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`h-9 min-w-11 shrink-0 rounded-full border px-3 text-sm font-semibold ${on ? "border-accent bg-accent text-white" : "border-g3 bg-card text-l4"}`}
    >
      {children}
    </button>
  );
}
