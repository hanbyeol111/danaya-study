"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useMe } from "@/components/Shell";
import { Bar, Chip, PlayButton, TopBar, useUI } from "@/components/ui";
import { MeaningChips } from "@/components/WordRow";
import { counts, dayName, loadLibrary, type Book } from "@/lib/words";
import { todayKST, type WordStatus } from "@/lib/rules";
import { supabase } from "@/lib/supabase";

type Filter = "all" | "shaky" | "new" | "known";
const FILTERS: [Filter, string][] = [["all", "전체"], ["shaky", "헷갈림"], ["new", "아직"], ["known", "외움"]];
const MODES = [
  ["blink", "깜빡이", "자동으로 넘기며 보고 듣기"],
  ["flash", "플래시카드", "뒤집어 보며 외우기"],
  ["choice", "객관식", "알맞은 뜻 고르기"],
  ["spell", "받아쓰기", "듣고 영어로 쓰기"],
] as const;

export default function BookPage() {
  const me = useMe();
  const router = useRouter();
  const { ask, toast } = useUI();
  const [id, setId] = useState<string | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [status, setStatus] = useState<Map<string, WordStatus>>(new Map());
  const [hasToday, setHasToday] = useState(true);
  const [day, setDay] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<{ id: string; en: string; pos: string; ko: string } | null>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams(window.location.search);
    const bid = p.get("id") ?? "none";
    setId(bid);
    const lib = await loadLibrary(me.id);
    const b = lib.books.find((x) => (x.id ?? "none") === bid);
    if (!b) return router.replace("/words");
    setBook(b);
    setStatus(lib.status);
    setHasToday(lib.books.some((x) => x.days.some((d) => d.study_date === todayKST())));
  }, [me.id, router]);

  useEffect(() => {
    setQ(new URLSearchParams(window.location.search).get("q") ?? "");
    load();
  }, [load]);

  if (!book) return <p className="p-8 text-center text-l3">불러오는 중…</p>;
  const c = counts(book.words, status);
  const pct = c.total ? Math.round((c.known / c.total) * 100) : 0;
  const cur = book.days.find((d) => d.id === day);
  const s = q.trim().toLowerCase();
  const list = (cur ? cur.words : book.words)
    .filter((w) => filter === "all" || (status.get(w.id) ?? "new") === filter)
    .filter((w) => !s || w.english.toLowerCase().includes(s) || w.korean.includes(s));
  const studyQs = `id=${id}${day ? `&day=${day}` : ""}${filter !== "all" ? `&f=${filter}` : ""}`;

  async function delBook() {
    if (!(await ask("단어장을 지울까요?", `${book!.title}의 Day ${book!.days.length}개, 단어 ${c.total}개가 두 사람 모두에게서 사라져요.`, "지우기"))) return;
    await supabase.from("word_books").delete().eq("id", book!.id!);
    toast("단어장을 지웠어요");
    router.replace("/words");
  }
  async function delDay() {
    if (!(await ask(`${dayName(cur!)}를 지울까요?`, `단어 ${cur!.words.length}개가 두 사람 모두에게서 사라져요.`, "지우기"))) return;
    await supabase.from("word_sets").delete().eq("id", cur!.id);
    setDay(null);
    load();
  }
  async function makeToday() {
    const { error } = await supabase.from("word_sets").update({ study_date: todayKST() }).eq("id", cur!.id);
    if (error) return toast("오늘 분량이 이미 있어요");
    toast(`${dayName(cur!)}를 오늘 분량으로 정했어요`);
    router.push("/");
  }

  return (
    <div className="flex flex-col gap-4">
      <TopBar back="단어장" href="/words" right={book.id && <button onClick={delBook} className="h-11 border-0 bg-transparent pl-3 text-[15px] text-bad-ink">단어장 삭제</button>} />
      <div className="flex flex-col gap-2.5">
        <div className="text-2xl font-bold">{book.title}</div>
        <Bar pct={pct} color="bg-me" />
        <div className="tnum flex gap-3.5 text-sm text-l2">
          <span>전체 {c.total}</span><span className="text-good-ink">외움 {c.known}</span><span className="text-bad-ink">헷갈림 {c.shaky}</span><span>아직 {c.total - c.known - c.shaky}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {MODES.map(([m, name, desc]) => (
          <Link key={m} href={`/words/study?mode=${m}&${studyQs}`} className={`flex flex-col gap-0.5 rounded-2xl bg-card px-3.5 py-3 ${list.length ? "" : "pointer-events-none opacity-50"}`}>
            <span className="text-base font-bold">{name}</span>
            <span className="text-[13px] text-l2">{desc}</span>
          </Link>
        ))}
      </div>
      <div className="-mt-1.5 text-center text-[13px] text-l3">아래에서 고른 Day·상태의 단어 {list.length}개로 공부해요</div>

      <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-0.5">
        <Chip on={!day} onClick={() => setDay(null)}>전체</Chip>
        {book.days.map((d) => <Chip key={d.id} on={day === d.id} onClick={() => setDay(d.id)}>{dayName(d)}</Chip>)}
        {book.id && <Link href={`/words/new?book=${book.id}`} className="flex h-9 shrink-0 items-center rounded-full px-3 text-sm font-semibold text-accent" style={{ border: "1.5px dashed var(--color-accent)" }}>+ Day</Link>}
      </div>
      {cur && (
        <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-2.5 text-sm">
          <span className="min-w-0 flex-1 text-l2">{cur.study_date ? `${cur.study_date === todayKST() ? "오늘" : cur.study_date} 분량` : "아직 공부할 날을 안 정했어요"}</span>
          {!cur.study_date && !hasToday && <button onClick={makeToday} className="h-9 rounded-[10px] border-0 bg-accent px-3 font-semibold text-white">오늘 분량으로</button>}
          <button onClick={delDay} className="h-9 border-0 bg-transparent px-1.5 text-l3">Day 삭제</button>
        </div>
      )}
      <div className="flex gap-1.5">{FILTERS.map(([f, label]) => <Chip key={f} on={filter === f} onClick={() => setFilter(f)}>{label}</Chip>)}</div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이 단어장에서 검색" type="search" autoCapitalize="off" className="field" />

      <div className="rounded-2xl bg-card py-0.5 pl-3.5 pr-2">
        {!list.length && <div className="py-4 text-[15px] text-l3">해당하는 단어가 없어요</div>}
        {list.map((w, i) => {
          const st = status.get(w.id);
          return (
            <div key={w.id} className="border-b border-bg last:border-0">
              {edit?.id === w.id ? (
                <div className="flex flex-col gap-1.5 py-2.5 pr-1.5">
                  <div className="flex gap-1.5">
                    <input value={edit.en} onChange={(e) => setEdit({ ...edit, en: e.target.value })} autoCapitalize="off" aria-label="영어" className="h-11 min-w-0 flex-1 rounded-[10px] border border-g3 px-3 text-base font-semibold outline-none focus:border-accent" />
                    <input value={edit.pos} onChange={(e) => setEdit({ ...edit, pos: e.target.value.slice(0, 20) })} placeholder="품사" aria-label="품사" className="h-11 w-20 rounded-[10px] border border-g3 px-3 text-[15px] outline-none focus:border-accent" />
                  </div>
                  <input value={edit.ko} onChange={(e) => setEdit({ ...edit, ko: e.target.value })} aria-label="뜻 (쉼표로 나눔)" className="h-11 rounded-[10px] border border-g3 px-3 text-[15px] outline-none focus:border-accent" />
                  <div className="flex justify-end gap-2">
                    <button onClick={async () => { if (await ask("단어를 지울까요?", `${w.english} · ${w.korean}`, "지우기")) { await supabase.from("words").delete().eq("id", w.id); setEdit(null); load(); } }} className="mr-auto h-10 border-0 bg-transparent px-1.5 text-sm text-bad-ink">삭제</button>
                    <button onClick={() => setEdit(null)} className="h-10 rounded-[10px] border-0 bg-bg px-3.5 text-sm">취소</button>
                    <button
                      disabled={!edit.en.trim() || !edit.ko.trim()}
                      onClick={async () => { await supabase.from("words").update({ english: edit.en.trim(), korean: edit.ko.trim(), pos: edit.pos.trim() }).eq("id", w.id); setEdit(null); load(); }}
                      className="h-10 rounded-[10px] border-0 bg-accent px-4 text-sm font-semibold text-white disabled:bg-g4"
                    >저장</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-1.5 py-3">
                  <span className="tnum w-[26px] pt-0.5 text-xs text-l3">{i + 1}</span>
                  <button onClick={() => setEdit({ id: w.id, en: w.english, pos: w.pos, ko: w.korean })} className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left">
                    <div className="flex items-center gap-1.5 text-[17px] font-[650]">
                      {w.english}
                      {st === "known" && <span className="text-xs font-bold text-good-ink">외움</span>}
                      {st === "shaky" && <span className="text-xs font-bold text-bad-ink">헷갈림</span>}
                    </div>
                    <MeaningChips w={w} />
                  </button>
                  <PlayButton text={w.english} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!!list.length && <div className="text-center text-[13px] text-l3">단어를 누르면 고칠 수 있어요</div>}
    </div>
  );
}
