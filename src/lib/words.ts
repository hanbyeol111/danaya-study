import { supabase, must } from "./supabase";
import { wordStatus, type WordStatus } from "./rules";
import { dayLabel } from "./browser";
import type { Word } from "./day";

export type Day = { id: string; book_id: string | null; title: string; position: number; study_date: string | null; created_by: string; words: Word[] };
/** id가 null이면 단어장 없이 날짜로만 올린 단어들(이전 버전 데이터) */
export type Book = { id: string | null; title: string; days: Day[]; words: Word[] };

export const WORD_COLS = "id,set_id,english,korean,pos,position";
export const dayName = (s: Pick<Day, "title" | "study_date">) => s.title || (s.study_date ? dayLabel(s.study_date) : "이름 없음");

/** 모든 단어장 + 내 단어별 상태 */
export async function loadLibrary(meId: string) {
  const [books, sets, att] = await Promise.all([
    supabase.from("word_books").select("id,title").order("created_at").then(must),
    supabase.from("word_sets").select(`id,book_id,title,position,study_date,created_by,words(${WORD_COLS})`).order("position").order("study_date").then(must),
    // shortcut: 내 시도 기록을 전부 가져와 상태를 계산한다. 수만 건이 넘으면 SQL 뷰로 바꾼다
    supabase.from("attempts").select("word_id,correct").eq("user_id", meId).order("created_at").range(0, 99999).then(must),
  ]);
  const days = sets as Day[];
  days.forEach((d) => d.words.sort((a, b) => a.position - b.position));
  const make = (id: string | null, title: string): Book => {
    const ds = days.filter((d) => d.book_id === id);
    return { id, title, days: ds, words: ds.flatMap((d) => d.words) };
  };
  const list = (books as { id: string; title: string }[]).map((b) => make(b.id, b.title));
  const loose = make(null, "날짜별로 올린 단어");
  return { books: loose.days.length ? [...list, loose] : list, status: wordStatus(att as { word_id: string; correct: boolean }[]) };
}

export function counts(words: Word[], status: Map<string, WordStatus>) {
  const known = words.filter((w) => status.get(w.id) === "known").length;
  const shaky = words.filter((w) => status.get(w.id) === "shaky").length;
  return { total: words.length, known, shaky };
}
