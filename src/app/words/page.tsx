"use client";

import Link from "next/link";
import { TOURS } from "@/lib/tours";
import Tour from "@/components/Tour";
import { useEffect, useState } from "react";
import { useMe } from "@/components/Shell";
import { Bar, PlayButton } from "@/components/ui";
import { MeaningChips } from "@/components/WordRow";
import { counts, loadLibrary, type Book } from "@/lib/words";
import type { WordStatus } from "@/lib/rules";

export default function WordsPage() {
  const me = useMe();
  const [lib, setLib] = useState<{ books: Book[]; status: Map<string, WordStatus> } | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => { loadLibrary(me.id).then(setLib); }, [me.id]);

  if (!lib) return <p className="p-8 text-center text-l3">불러오는 중…</p>;
  const s = q.trim().toLowerCase();
  const hits = s ? lib.books.flatMap((b) => b.words.map((w) => ({ w, b }))).filter(({ w }) => w.english.toLowerCase().includes(s) || w.korean.includes(s)).slice(0, 50) : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between pt-1.5">
        <div className="text-[26px] font-bold">단어장</div>
        <Link data-tour="add-words" href="/words/new" className="flex h-11 items-center rounded-xl bg-accent px-4 text-[15px] font-semibold text-white">+ 단어 추가</Link>
      </div>
      <input data-tour="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="모든 단어장에서 검색 (영어·뜻)" type="search" autoCapitalize="off" className="field" />

      {s ? (
        <div className="rounded-2xl bg-card px-4 py-1">
          {!hits.length && <div className="py-4 text-[15px] text-l3">찾는 단어가 없어요</div>}
          {hits.map(({ w, b }) => (
            <Link key={w.id} href={`/words/book?id=${b.id ?? "none"}&q=${encodeURIComponent(w.english)}`} className="flex min-h-14 items-center gap-3 border-b border-bg py-2 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="text-base font-[650]">{w.english} <span className="text-xs font-normal text-l3">{b.title}</span></div>
                <MeaningChips w={w} small />
              </div>
              <PlayButton text={w.english} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {!lib.books.length && (
            <div className="rounded-2xl px-4 py-6 text-center text-[15px] leading-normal text-l2" style={{ border: "1.5px dashed var(--color-g4)" }}>
              아직 단어장이 없어요<br />단어장 사진을 찍어서 Day 1부터 만들어 보세요
            </div>
          )}
          {lib.books.map((b) => {
            const c = counts(b.words, lib.status);
            const pct = c.total ? Math.round((c.known / c.total) * 100) : 0;
            return (
              <Link data-tour="book-card" key={b.id ?? "none"} href={`/words/book?id=${b.id ?? "none"}`} className="flex flex-col gap-2.5 rounded-2xl bg-card px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[17px] font-bold">{b.title}</span>
                  <span className="tnum text-[15px] font-semibold text-me">{pct}%</span>
                  <span className="text-xl text-g4">›</span>
                </div>
                <Bar pct={pct} color="bg-me" />
                <div className="tnum flex gap-3.5 text-sm text-l2">
                  <span>Day {b.days.length}개</span>
                  <span>전체 {c.total}</span>
                  <span className="text-good-ink">외움 {c.known}</span>
                  <span className="text-bad-ink">헷갈림 {c.shaky}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <Tour id="words" steps={TOURS.words} />
    </div>
  );
}
