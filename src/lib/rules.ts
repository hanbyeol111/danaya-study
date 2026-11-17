// 7절 규칙. UI·DB와 분리된 순수 함수. 날짜는 모두 'YYYY-MM-DD' (Asia/Seoul) 문자열.

export function todayKST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000);
}

export const REVIEW_DAILY_MAX = 30;
const REVIEW_GAP = [1, 3, 7]; // stage 0→1일, 1→3일, 2→7일 뒤

export type ReviewItem = { word_id: string; stage: number; due_date: string };
export type Attempt = { word_id: string; mode: "en2ko" | "ko2en" | "review" | "practice"; correct: boolean };

/** 오늘 복습 대상: 오늘 이미 복습에서 푼 단어 + 아직 남은 기한 지난 단어(오래된 순), 합계 최대 30개 */
export function todaysReview(items: ReviewItem[], todayAttempts: Attempt[], today: string) {
  const touched = new Set(todayAttempts.filter((a) => a.mode === "review").map((a) => a.word_id));
  const passed = new Set(todayAttempts.filter((a) => a.mode === "review" && a.correct).map((a) => a.word_id));
  const pending = items
    .filter((i) => !touched.has(i.word_id) && i.stage < 3 && i.due_date <= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map((i) => i.word_id);
  const queue = [...touched, ...pending].slice(0, Math.max(REVIEW_DAILY_MAX, touched.size));
  return { queue, passed, remaining: queue.filter((id) => !passed.has(id)) };
}

export type Progress = {
  hasSet: boolean;
  n: number;
  en2ko: number;
  ko2en: number;
  reviewDone: number;
  reviewTotal: number;
  ratio: number; // 0~1
};

export function computeProgress(
  wordIds: string[],
  todayAttempts: Attempt[],
  reviewQueue: string[],
  reviewPassed: Set<string>,
): Progress {
  const ids = new Set(wordIds);
  const correct = (mode: Attempt["mode"]) =>
    new Set(todayAttempts.filter((a) => a.mode === mode && a.correct && ids.has(a.word_id)).map((a) => a.word_id)).size;
  const en2ko = correct("en2ko");
  const ko2en = correct("ko2en");
  const reviewDone = reviewQueue.filter((id) => reviewPassed.has(id)).length;
  const n = ids.size;
  const total = 2 * n + reviewQueue.length;
  const hasSet = n > 0;
  return {
    hasSet, n, en2ko, ko2en, reviewDone, reviewTotal: reviewQueue.length,
    ratio: hasSet && total > 0 ? (en2ko + ko2en + reviewDone) / total : 0,
  };
}

/** 퀴즈에서 틀렸을 때(en2ko/ko2en/review 모두): stage 0, 내일 다시 */
export function reviewOnWrong(today: string) {
  return { stage: 0, due_date: addDays(today, 1) };
}

/** 복습에서 맞혔을 때. 오늘 이미 복습에서 틀렸던 단어면 stage를 올리지 않는다. */
export function reviewOnCorrect(item: { stage: number; due_date: string }, today: string, failedToday: boolean) {
  if (failedToday) return { stage: item.stage, due_date: item.due_date };
  const stage = item.stage + 1;
  return { stage, due_date: stage >= 3 ? item.due_date : addDays(today, REVIEW_GAP[stage]) };
}

/** 오늘(또는 어제)부터 거꾸로 센 연속 완료 일수 */
export function streak(done: Set<string>, today: string): number {
  let d = done.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (done.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function intersect(a: Set<string>, b: Set<string>): Set<string> {
  return new Set([...a].filter((x) => b.has(x)));
}

/** 항목 n개를 start~end(포함) 날짜에 고르게 나눈다. k번째 날 = floor(k·n/D) ~ floor((k+1)·n/D)-1번 항목 */
export function distributeUnits(n: number, start: string, end: string): string[] {
  const days = daysBetween(start, end) + 1;
  if (days < 1) throw new Error("종료일이 시작일보다 빠릅니다");
  const out: string[] = [];
  for (let k = 0; k < days; k++) {
    const to = Math.floor(((k + 1) * n) / days);
    while (out.length < to) out.push(addDays(start, k));
  }
  return out;
}

export function gradeTyped(answer: string, english: string): boolean {
  return answer.trim().toLowerCase() === english.trim().toLowerCase();
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** "(잘못, 사실 등을)인정하다, 시인하다; 허가하다" → 괄호 안 쉼표는 그대로 두고 뜻별로 나눈다 */
export function splitMeanings(korean: string): string[] {
  return korean.split(/[,;](?![^(]*\))/).map((m) => m.trim()).filter(Boolean);
}

export type WordStatus = "new" | "known" | "shaky";
/** 단어별 내 상태: 마지막 시도가 맞으면 외움, 틀리면 헷갈림, 시도 없으면 new. attempts는 오래된 순 */
export function wordStatus(attempts: { word_id: string; correct: boolean }[]): Map<string, WordStatus> {
  const m = new Map<string, WordStatus>();
  for (const a of attempts) m.set(a.word_id, a.correct ? "known" : "shaky");
  return m;
}

/** 학습 플랜처럼 하루에 여러 항목이 묶인 경우: 같은 day끼리 같은 날짜. day가 없으면 항목 하나가 하루 */
export function distributeByDay(days: (number | null)[], start: string, end: string): string[] {
  const keys = days.map((d, i) => (d == null ? `i${i}` : `d${d}`));
  const order = [...new Set(keys)];
  const dates = distributeUnits(order.length, start, end);
  const at = new Map(order.map((k, i) => [k, dates[i]]));
  return keys.map((k) => at.get(k)!);
}
