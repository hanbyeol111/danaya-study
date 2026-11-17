"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Segment, TopBar } from "@/components/ui";
import { EXAM_DAY, PARTS, STUDY_TIPS, type PartGuide } from "@/lib/guide";
import { supabase } from "@/lib/supabase";

export default function GuidePage() {
  const [side, setSide] = useState<"lc" | "rc">("rc");
  const [wrong, setWrong] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    const h = window.location.hash.match(/^#p(\d)$/);
    if (h && Number(h[1]) <= 4) setSide("lc");
    supabase.from("wrong_notes").select("part").eq("solved", false).then(({ data }) => {
      const m = new Map<number, number>();
      (data ?? []).forEach((n) => n.part && m.set(n.part, (m.get(n.part) ?? 0) + 1));
      setWrong(m);
    });
  }, []);

  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, [side]);

  const parts = PARTS.filter((p) => (side === "lc" ? p.part <= 4 : p.part >= 5));
  const weak = [...wrong].sort((a, b) => b[1] - a[1])[0];
  const weakGuide = weak && PARTS.find((p) => p.part === weak[0]);

  return (
    <div className="flex flex-col gap-4">
      <TopBar back="책" href="/book" />
      <div className="flex flex-col gap-1">
        <div className="text-[26px] font-bold">해커스 토익 가이드</div>
        <div className="text-sm leading-normal text-l2">책 앞부분의 출제 경향·학습법을 파트별로 모았어요.<br />쪽 번호는 두 사람이 가진 책 기준이에요.</div>
      </div>

      {weakGuide && (
        <a href={`#p${weakGuide.part}`} onClick={() => setSide(weakGuide.part <= 4 ? "lc" : "rc")} className="flex flex-col gap-1 rounded-2xl bg-bad-bg px-4 py-3.5">
          <span className="text-[13px] font-semibold text-bad-ink">내 오답이 가장 많은 파트</span>
          <span className="text-[17px] font-bold">Part {weakGuide.part} {weakGuide.name} · 안 푼 오답 {weak[1]}개</span>
          <span className="text-sm text-l4">교재 {weakGuide.refs.map((r) => r.pages).join(", ")} 다시 보기 ›</span>
        </a>
      )}

      <Segment value={side} options={[["lc", "LISTENING"], ["rc", "READING"]]} onChange={setSide} />
      {parts.map((p) => <PartCard key={p.part} p={p} wrong={wrong.get(p.part) ?? 0} />)}

      <section className="flex flex-col gap-2">
        <div className="px-1 text-lg font-bold">책 200% 활용법</div>
        {STUDY_TIPS.map((t) => (
          <div key={t.title} className="rounded-2xl bg-card px-4 py-3.5">
            <div className="text-base font-bold">{t.title}</div>
            <div className="mt-1 text-sm leading-normal text-l4">{t.body}</div>
          </div>
        ))}
        <Link href="/words/new" className="btn-secondary">RC 필수 어휘 오늘 장 찍어서 단어장에 넣기</Link>
      </section>

      <section id="exam" className="flex scroll-mt-4 flex-col gap-2">
        <div className="px-1 text-lg font-bold">시험 당일</div>
        <div className="rounded-2xl bg-card px-4 py-3.5">
          <div className="text-sm font-semibold text-l2">준비물</div>
          <ul className="mt-1.5 flex flex-col gap-1 text-[15px]">{EXAM_DAY.bring.map((b) => <li key={b}>☐ {b}</li>)}</ul>
        </div>
        <div className="rounded-2xl bg-card px-4 py-2">
          {EXAM_DAY.schedule.map(([t, what]) => (
            <div key={t} className="tnum flex min-h-10 items-center gap-3 border-b border-bg text-[15px] last:border-0">
              <span className="w-[104px] shrink-0 text-l2">{t}</span><span>{what}</span>
            </div>
          ))}
        </div>
        <ul className="flex flex-col gap-1 px-1 text-[13px] leading-normal text-l2">{EXAM_DAY.notes.map((n) => <li key={n}>· {n}</li>)}</ul>
      </section>
    </div>
  );
}

function PartCard({ p, wrong }: { p: PartGuide; wrong: number }) {
  return (
    <section id={`p${p.part}`} className="flex scroll-mt-4 flex-col gap-2.5 rounded-2xl bg-card px-4 py-4">
      <div className="flex items-baseline gap-2">
        <span className="text-[19px] font-bold">Part {p.part}</span>
        <span className="text-[15px] font-semibold text-l4">{p.name}</span>
        <span className="flex-1" />
        {wrong > 0 && <Link href="/book?tab=notes" className="text-[13px] font-semibold text-bad-ink">내 오답 {wrong}개 ›</Link>}
      </div>
      <div className="text-[13px] text-l2">{p.count}{p.time && ` · 권장 ${p.time}`}</div>
      <ul className="flex flex-col gap-1.5 text-[15px] leading-normal">{p.trends.map((t) => <li key={t}>• {t}</li>)}</ul>
      {p.ratio && (
        <div className="flex flex-col gap-1">
          {p.ratio.map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 text-[13px]">
              <span className="w-[120px] shrink-0 text-l2">{k}</span>
              <span className="h-2 rounded bg-accent" style={{ width: `${Math.max(4, (v / Math.max(...p.ratio!.map((r) => r[1]))) * 55)}%` }} />
              <span className="tnum text-l4">{p.part === 6 ? `${v}문제` : `${v}%`}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-1 rounded-xl bg-bg px-3 py-2.5">
        <div className="text-[13px] font-semibold text-l2">교재에서 볼 곳</div>
        {p.refs.map((r) => (
          <div key={r.label} className="flex justify-between gap-3 text-sm"><span>{r.label}</span><span className="tnum shrink-0 font-semibold text-accent">{r.pages}</span></div>
        ))}
      </div>
    </section>
  );
}
