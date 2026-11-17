// 할 일 제목(예: "Part 4 Course 1-1~1-5", "Grammar Ch 3", "RC 필수 어휘 3일")을 보고
// 그날 공부에 맞는 해커스 무료 강의·MP3를 골라 준다.
// 강의는 팝업 플레이어라 강의 하나로 바로 가는 주소가 없다 → 책의 무료강의 페이지 + "몇 강"을 알려 준다.
// MP3·프로그램은 해커스 로그인 뒤에 있어서 앱에 복사하지 않고, 그 책의 자료 페이지로 보낸다.
import { partGuide } from "./guide.ts";

const CODES: Record<number, { lc: number; rc: number }> = { 9: { lc: 1034, rc: 1035 }, 8: { lc: 728, rc: 727 } };
const LECTURE = { lc: "https://www.hackers.co.kr/free-lecture?idx=18", rc: "https://www.hackers.co.kr/free-lecture?idx=20" };

// 해커스토익 무료강의 목록 (2026-11 기준). 리딩은 n강 = 문법 Ch n + 어휘 Ch n
const RC_GRAMMAR = ["주어/동사", "목적어/보어", "수식어", "동사의 형태와 종류", "주어와 수 일치", "능동태/수동태", "시제", "가정법"];
const RC_VOCAB = ["동사 1", "동사 2", "명사 1", "명사 2", "명사 3", "형용사 1", "형용사 2", "형용사 3"];
const LC_LECTURES: Record<number, string[]> = {
  1: ["1강 수동태의 이해", "2강 상태·동작 표현"],
  2: ["4강 의문사 의문문 총정리", "5강 선택 의문문 총정리"],
  3: ["3강 문제와 보기의 이해"],
  4: ["3강 문제와 보기의 이해"],
};

export type Kind = "lc" | "rc";
export type Resource = { type: "강의" | "MP3" | "연습" | "교재"; label: string; url: string };

export function kindOf(title: string): Kind | null {
  if (/listening|리스닝|\blc\b|part\s*[1-4]\b/i.test(title)) return "lc";
  if (/reading|리딩|\brc\b|grammar|vocab|문법|어휘|part\s*[5-7]\b/i.test(title)) return "rc";
  return null;
}

export const hackersUrl = (kind: Kind, edition: number) =>
  `https://champ.hackers.com/?r=champstudy&c=mp3/mp3_free&p=1&cate1_cd=sf008&cate2_cd=&cate3_cd=${(CODES[edition] ?? CODES[9])[kind]}`;

const num = (re: RegExp, s: string) => {
  const m = s.match(re);
  return m ? Number(m[1] ?? m[2]) : null;
};

/** 할 일 하나에 맞는 자료. bookTitle은 그 할 일이 속한 책(없으면 빈 문자열) */
export function resourcesFor(title: string, bookTitle: string, edition: number): Resource[] {
  const all = `${bookTitle} ${title}`;
  const kind = kindOf(title) ?? kindOf(bookTitle);
  const out: Resource[] = [];
  const files = (label: string, k: Kind) => out.push({ type: "MP3", label, url: hackersUrl(k, edition) });

  // 단어: "RC 필수 어휘 3일", "보카 Day 3"
  const vocabDay = /어휘|보카|voca|단어/i.test(all) && !/grammar|문법|ch(apter)?\s*\d/i.test(title) ? num(/(\d+)\s*일|day\s*(\d+)/i, title) : null;
  if (vocabDay) {
    files(`단어암기 MP3 · ${vocabDay}일 파일`, kind ?? "rc");
    return out;
  }
  if (!kind) return out;

  if (/진단/.test(title)) {
    files("진단고사 MP3", kind);
    out.push({ type: "강의", label: "진단고사 해설강의", url: hackersUrl(kind, edition) });
    return out;
  }
  if (/실전\s*(모의)?|모의고사/.test(title)) {
    out.push({ type: "연습", label: "온라인 실전모의고사 (해커스토익)", url: hackersUrl(kind, edition) });
    return out;
  }

  const part = num(/part\s*(\d)/i, title);
  const ch = num(/ch(?:apter)?\.?\s*(\d+)/i, title);

  if (kind === "lc") {
    for (const l of (part && LC_LECTURES[part]) || []) out.push({ type: "강의", label: `무료강의 ${l}`, url: LECTURE.lc });
    if (part) {
      files(`문제풀이 MP3 · Part ${part}`, "lc");
      out.push({ type: "연습", label: `받아쓰기&쉐도잉 · Part ${part}`, url: hackersUrl("lc", edition) });
    }
  } else {
    const isVocab = /vocab|어휘/i.test(title);
    const isGrammar = /grammar|문법/i.test(title) || (!isVocab && !/reading|독해/i.test(title));
    if (ch && ch <= 8 && isGrammar) out.push({ type: "강의", label: `무료강의 ${ch}강 · 문법. ${RC_GRAMMAR[ch - 1]}`, url: LECTURE.rc });
    if (ch && ch <= 8 && isVocab) out.push({ type: "강의", label: `무료강의 ${ch}강 · 어휘. ${RC_VOCAB[ch - 1]}`, url: LECTURE.rc });
    if (/reading|독해/i.test(title) && !part) {
      const g = partGuide(7)!;
      out.push({ type: "교재", label: `Part 7 유형별 전략 ${g.refs[0].pages}~`, url: "/book/guide#p7" });
    }
  }
  const g = part ? partGuide(part) : null;
  if (g) out.push({ type: "교재", label: `Part ${part} 출제 경향·교재 쪽`, url: `/book/guide#p${part}` });
  return out;
}
