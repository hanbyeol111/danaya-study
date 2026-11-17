"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useMe } from "@/components/Shell";
import { PlayButton, Sub, TopBar, useUI } from "@/components/ui";
import { supabase, must } from "@/lib/supabase";
import { dayLabel, fmtDate } from "@/lib/browser";
import { todayKST } from "@/lib/rules";
import type { Word } from "@/lib/day";

type WordSet = { id: string; study_date: string; created_by: string; words: Word[] };

export default function WordsPage() {
  const me = useMe();
  const { ask, toast } = useUI();
  const [sets, setSets] = useState<WordSet[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [wrong, setWrong] = useState<{ word: Word; n: number }[]>([]);

  const load = useCallback(async () => {
    const [data, prof, att] = await Promise.all([
      supabase.from("word_sets").select("id,study_date,created_by,words(id,set_id,english,korean,position)").order("study_date", { ascending: false }).then(must),
      supabase.from("profiles").select("id,name").then(must),
      supabase.from("attempts").select("word_id").eq("user_id", me.id).eq("correct", false).then(must),
    ]);
    const ss = data as WordSet[];
    ss.forEach((s) => s.words.sort((a, b) => a.position - b.position));
    setSets(ss);
    setNames(Object.fromEntries((prof as { id: string; name: string }[]).map((p) => [p.id, p.name])));
    const count = new Map<string, number>();
    (att as { word_id: string }[]).forEach((a) => count.set(a.word_id, (count.get(a.word_id) ?? 0) + 1));
    const all = new Map(ss.flatMap((s) => s.words).map((w) => [w.id, w]));
    setWrong([...count].filter(([id]) => all.has(id)).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([id, n]) => ({ word: all.get(id)!, n })));
  }, [me.id]);

  useEffect(() => { load(); }, [load]);

  if (!sets) return <p className="p-8 text-center text-l3">불러오는 중…</p>;
  const today = todayKST();
  const cur = sets.find((s) => s.id === openId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between pt-1.5">
        <div className="text-[26px] font-bold">단어장</div>
        <Link href="/words/new" className="flex h-11 items-center rounded-xl bg-accent px-4 text-[15px] font-semibold text-white">+ 단어 추가</Link>
      </div>

      <div className="flex flex-col gap-2.5">
        {sets.length === 0 && <div className="rounded-2xl px-4 py-6 text-center text-[15px] text-l2" style={{ border: "1.5px dashed var(--color-g4)" }}>아직 단어장이 없어요</div>}
        {sets.map((s) => (
          <button key={s.id} onClick={() => setOpenId(s.id)} className="flex min-h-[72px] items-center gap-3 rounded-2xl border-0 bg-card px-4 py-3.5 text-left">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[17px] font-bold">{dayLabel(s.study_date)}</span>
                {s.study_date === today && <span className="rounded-md bg-accent px-[7px] py-0.5 text-xs font-bold text-white">오늘</span>}
              </div>
              <div className="text-sm text-l2">{s.words.length}개 · {names[s.created_by] ?? ""} 올림</div>
            </div>
            <span className="text-xl text-g4">›</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between"><div className="text-[17px] font-bold">내가 자주 틀리는 단어</div><div className="text-[13px] text-l3">틀린 횟수 순</div></div>
        <div className="rounded-2xl bg-card px-4 py-1">
          {wrong.length === 0 && <div className="py-4 text-[15px] text-l3">아직 틀린 단어가 없어요</div>}
          {wrong.map(({ word, n }, i) => (
            <div key={word.id} className="flex min-h-14 items-center gap-3 border-b border-bg last:border-0">
              <span className="tnum w-5 text-[13px] text-l3">{i + 1}</span>
              <div className="min-w-0 flex-1"><div className="text-base font-[650]">{word.english}</div><div className="text-[13px] text-l2">{word.korean}</div></div>
              <span className="text-[13px] font-semibold text-bad-ink">{n}회</span>
              <PlayButton text={word.english} />
            </div>
          ))}
        </div>
      </div>

      {cur && (
        <SetDetail
          set={cur} by={names[cur.created_by] ?? ""} onBack={() => setOpenId(null)} reload={load}
          onDelete={async () => {
            if (!(await ask("이 단어장을 지울까요?", `${fmtDate(cur.study_date)} 단어장과 단어 ${cur.words.length}개가 두 사람 모두에게서 사라져요.`, "지우기"))) return;
            await supabase.from("word_sets").delete().eq("id", cur.id);
            setOpenId(null);
            toast("단어장을 지웠어요");
            load();
          }}
        />
      )}
    </div>
  );
}

function SetDetail({ set, by, onBack, onDelete, reload }: { set: WordSet; by: string; onBack: () => void; onDelete: () => void; reload: () => void }) {
  const { ask } = useUI();
  const [edit, setEdit] = useState<{ id: string; en: string; ko: string } | null>(null);
  return (
    <Sub pad={false}>
      <TopBar back="단어장" onBack={onBack} className="px-5" right={<button onClick={onDelete} className="h-11 border-0 bg-transparent pl-3 text-[15px] text-bad-ink">단어장 삭제</button>} />
      <div className="px-5 pb-3.5 pt-1">
        <div className="text-2xl font-bold">{dayLabel(set.study_date)}</div>
        <div className="mt-1 text-sm text-l2">{set.words.length}개 · {by} 올림</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10">
        <div className="rounded-2xl bg-card py-0.5 pl-3.5 pr-2">
          {set.words.map((w, i) => (
            <div key={w.id} className="border-b border-bg last:border-0">
              {edit?.id === w.id ? (
                <div className="flex flex-col gap-1.5 py-2.5 pr-1.5">
                  <input value={edit.en} onChange={(e) => setEdit({ ...edit, en: e.target.value })} autoCapitalize="off" className="h-11 rounded-[10px] border border-g3 px-3 text-base font-semibold outline-none focus:border-accent" />
                  <input value={edit.ko} onChange={(e) => setEdit({ ...edit, ko: e.target.value })} className="h-11 rounded-[10px] border border-g3 px-3 text-[15px] outline-none focus:border-accent" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEdit(null)} className="h-10 rounded-[10px] border-0 bg-bg px-3.5 text-sm">취소</button>
                    <button
                      disabled={!edit.en.trim() || !edit.ko.trim()}
                      onClick={async () => { await supabase.from("words").update({ english: edit.en.trim(), korean: edit.ko.trim() }).eq("id", w.id); setEdit(null); reload(); }}
                      className="h-10 rounded-[10px] border-0 bg-accent px-4 text-sm font-semibold text-white disabled:bg-g4"
                    >저장</button>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[60px] items-center gap-1.5">
                  <span className="tnum w-[22px] text-xs text-l3">{i + 1}</span>
                  <div className="min-w-0 flex-1"><div className="text-base font-[650]">{w.english}</div><div className="text-sm text-l2">{w.korean}</div></div>
                  <PlayButton text={w.english} />
                  <button onClick={() => setEdit({ id: w.id, en: w.english, ko: w.korean })} className="h-10 border-0 bg-transparent px-2 text-sm text-l2">수정</button>
                  <button
                    onClick={async () => { if (await ask("단어를 지울까요?", `${w.english} · ${w.korean}`, "지우기")) { await supabase.from("words").delete().eq("id", w.id); reload(); } }}
                    className="h-10 border-0 bg-transparent px-1.5 text-sm text-l3"
                  >삭제</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Sub>
  );
}
