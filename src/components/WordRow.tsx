import { splitMeanings } from "@/lib/rules";
import type { Word } from "@/lib/day";

/** 품사 칩 + 뜻 칩 */
export function MeaningChips({ w, small }: { w: Pick<Word, "pos" | "korean">; small?: boolean }) {
  const cls = `rounded-lg border px-2 ${small ? "py-px text-[13px]" : "py-0.5 text-sm"}`;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {w.pos && <span className={`${cls} border-accent/40 text-accent`}>{w.pos}</span>}
      {splitMeanings(w.korean).map((m, i) => <span key={i} className={`${cls} border-g3 text-l4`}>{m}</span>)}
    </div>
  );
}
