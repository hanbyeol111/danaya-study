import { test } from "node:test";
import assert from "node:assert/strict";
import {
  todayKST, addDays, todaysReview, computeProgress, reviewOnWrong, reviewOnCorrect,
  streak, intersect, distributeUnits, gradeTyped, splitMeanings, wordStatus, distributeByDay, type Attempt,
} from "./rules.ts";

test("todayKST: 한국 자정에 날짜가 바뀐다", () => {
  assert.equal(todayKST(new Date("2026-11-17T14:59:59Z")), "2026-11-17");
  assert.equal(todayKST(new Date("2026-11-17T15:00:00Z")), "2026-11-18");
});

test("addDays: 월·연 경계", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2027-03-01", -1), "2027-02-28");
});

test("진도율: 40개 중 뜻 20개, 복습 0개 → 25%", () => {
  const ids = Array.from({ length: 40 }, (_, i) => "w" + i);
  const att: Attempt[] = ids.slice(0, 20).map((word_id) => ({ word_id, mode: "en2ko", correct: true }));
  att.push({ word_id: "w30", mode: "en2ko", correct: false });
  assert.equal(computeProgress(ids, att, [], new Set()).ratio, 0.25);
});

test("진도율: 세트 없으면 0", () => {
  assert.equal(computeProgress([], [], ["r1"], new Set()).ratio, 0);
});

test("오늘 복습: 통과+남은 수, 오래된 순, 최대 30개", () => {
  const items = Array.from({ length: 40 }, (_, i) => ({
    word_id: "r" + i, stage: 0, due_date: addDays("2026-11-17", -(i % 5)),
  }));
  items.push({ word_id: "future", stage: 0, due_date: "2026-11-18" });
  items.push({ word_id: "grad", stage: 3, due_date: "2026-11-01" });
  const r = todaysReview(items, [], "2026-11-17");
  assert.equal(r.queue.length, 30);
  assert.ok(!r.queue.includes("future") && !r.queue.includes("grad"));
  assert.equal(items.find((i) => i.word_id === r.queue[0])!.due_date, "2026-11-13");

  // 복습에서 틀려서 due가 내일로 밀려도 오늘 대상에 남는다
  const moved = [{ word_id: "x", stage: 0, due_date: "2026-11-18" }];
  const att: Attempt[] = [{ word_id: "x", mode: "review", correct: false }];
  const r2 = todaysReview(moved, att, "2026-11-17");
  assert.deepEqual(r2.remaining, ["x"]);
  att.push({ word_id: "x", mode: "review", correct: true });
  const r3 = todaysReview(moved, att, "2026-11-17");
  assert.deepEqual(r3.remaining, []);
  assert.equal(computeProgress(["a"], [{ word_id: "a", mode: "en2ko", correct: true }, { word_id: "a", mode: "ko2en", correct: true }], r3.queue, r3.passed).ratio, 1);
});

test("복습 간격: 틀림→내일, 맞힘→3일→7일→졸업", () => {
  const t = "2026-11-17";
  let s = reviewOnWrong(t);
  assert.deepEqual(s, { stage: 0, due_date: "2026-11-18" });
  s = reviewOnCorrect(s, "2026-11-18", false);
  assert.deepEqual(s, { stage: 1, due_date: "2026-11-21" });
  s = reviewOnCorrect(s, "2026-11-21", false);
  assert.deepEqual(s, { stage: 2, due_date: "2026-11-28" });
  s = reviewOnCorrect(s, "2026-11-28", false);
  assert.equal(s.stage, 3);
  // 오늘 틀린 뒤 다시 맞혀도 stage 유지
  assert.deepEqual(reviewOnCorrect({ stage: 0, due_date: "2026-11-18" }, t, true), { stage: 0, due_date: "2026-11-18" });
});

test("연속: 오늘 못 끝내도 어제까지 이어지면 유지", () => {
  const done = new Set(["2026-11-14", "2026-11-15", "2026-11-16"]);
  assert.equal(streak(done, "2026-11-17"), 3);
  done.add("2026-11-17");
  assert.equal(streak(done, "2026-11-17"), 4);
  assert.equal(streak(new Set(["2026-11-15"]), "2026-11-17"), 0);
});

test("둘 다 연속: 둘 다 완료한 날만", () => {
  const a = new Set(["2026-11-15", "2026-11-16", "2026-11-17"]);
  const b = new Set(["2026-11-14", "2026-11-16", "2026-11-17"]);
  assert.equal(streak(intersect(a, b), "2026-11-17"), 2);
});

test("책 계획 나누기", () => {
  const d30 = distributeUnits(30, "2026-11-01", "2026-11-30");
  assert.equal(d30[0], "2026-11-01");
  assert.equal(d30[29], "2026-11-30");
  assert.equal(new Set(d30).size, 30);
  const d10 = distributeUnits(30, "2026-11-01", "2026-11-10");
  assert.deepEqual(d10.slice(0, 4), ["2026-11-01", "2026-11-01", "2026-11-01", "2026-11-02"]);
  assert.equal(d10[29], "2026-11-10");
  const sparse = distributeUnits(2, "2026-11-01", "2026-11-04");
  assert.deepEqual(sparse, ["2026-11-02", "2026-11-04"]);
  assert.throws(() => distributeUnits(3, "2026-11-05", "2026-11-04"));
});

test("영어 입력 채점: 공백·대소문자 무시", () => {
  assert.ok(gradeTyped("  Allocate ", "allocate"));
  assert.ok(!gradeTyped("allocates", "allocate"));
});

test("splitMeanings: 괄호 안 쉼표는 나누지 않는다", () => {
  assert.deepEqual(splitMeanings("(잘못, 사실 등을)인정하다, 시인하다; 허가하다"), ["(잘못, 사실 등을)인정하다", "시인하다", "허가하다"]);
  assert.deepEqual(splitMeanings("줄이다(=curtail, lessen)"), ["줄이다(=curtail, lessen)"]);
});

test("wordStatus: 마지막 시도로 정한다", () => {
  const m = wordStatus([{ word_id: "a", correct: false }, { word_id: "a", correct: true }, { word_id: "b", correct: false }]);
  assert.equal(m.get("a"), "known");
  assert.equal(m.get("b"), "shaky");
  assert.equal(m.get("c"), undefined);
});

test("distributeByDay: 같은 day는 같은 날짜", () => {
  const d = distributeByDay([1, 1, 2, 2, 3], "2026-11-17", "2026-11-19");
  assert.deepEqual(d, ["2026-11-17", "2026-11-17", "2026-11-18", "2026-11-18", "2026-11-19"]);
  assert.deepEqual(distributeByDay([null, null], "2026-11-17", "2026-11-18"), ["2026-11-17", "2026-11-18"]);
});
