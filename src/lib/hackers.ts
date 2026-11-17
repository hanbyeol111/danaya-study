// 해커스 토익 LISTENING/READING 기본서의 무료 자료 페이지(해커스인강).
// 자료 파일은 해커스 로그인 뒤에 있어서 앱에 복사하지 않고, 그 책의 자료 페이지로 바로 보낸다.
const CODES: Record<number, { lc: number; rc: number }> = { 9: { lc: 1034, rc: 1035 }, 8: { lc: 728, rc: 727 } };

export type Kind = "lc" | "rc";

export function kindOf(bookTitle: string): Kind | null {
  if (/listening|리스닝|\blc\b/i.test(bookTitle)) return "lc";
  if (/reading|리딩|\brc\b/i.test(bookTitle)) return "rc";
  return null;
}

export const hackersUrl = (kind: Kind, edition: number) =>
  `https://champ.hackers.com/?r=champstudy&c=mp3/mp3_free&p=1&cate1_cd=sf008&cate2_cd=&cate3_cd=${(CODES[edition] ?? CODES[9])[kind]}`;

/** 오늘 범위 제목을 보고 해커스 자료 페이지에서 눌러야 할 항목을 고른다 */
export function picksFor(kind: Kind, unitTitle: string): string[] {
  if (/진단/.test(unitTitle)) return ["진단고사 MP3", "진단고사 해설강의"];
  if (/실전|모의|test/i.test(unitTitle)) return ["온라인 모의고사"];
  return kind === "lc"
    ? ["문제풀이 MP3", "받아쓰기&쉐도잉", "단어암기 MP3"]
    : ["문법&어휘 무료강의", "단어암기 MP3"];
}
