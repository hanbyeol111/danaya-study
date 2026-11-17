import { test } from "node:test";
import assert from "node:assert/strict";
import { kindOf, resourcesFor, hackersUrl } from "./hackers.ts";

const labels = (t: string, book = "") => resourcesFor(t, book, 9).map((r) => r.label);

test("kindOf: 책 이름·파트로 LC/RC 구분", () => {
  assert.equal(kindOf("해커스 토익 LISTENING"), "lc");
  assert.equal(kindOf("Part 4 Course 1-1"), "lc");
  assert.equal(kindOf("Grammar Ch 3"), "rc");
  assert.equal(kindOf("영단어 외우기"), null);
});

test("resourcesFor: LC 파트별 강의·MP3", () => {
  const p4 = labels("Part 4 Course 1-1~Course 1-5", "LC 교재");
  assert.ok(p4.includes("문제풀이 MP3 · Part 4"));
  assert.ok(p4.includes("받아쓰기&쉐도잉 · Part 4"));
  assert.ok(p4.some((l) => l.startsWith("무료강의")));
  assert.ok(labels("Part 1 Course 2-1").includes("무료강의 2강 상태·동작 표현"));
});

test("resourcesFor: RC 챕터 → 몇 강", () => {
  assert.deepEqual(labels("Grammar Ch 3"), ["무료강의 3강 · 문법. 수식어"]);
  assert.deepEqual(labels("Vocabulary Ch 2"), ["무료강의 2강 · 어휘. 동사 2"]);
  assert.deepEqual(labels("Grammar Ch 12"), []);
});

test("resourcesFor: 단어·진단·실전", () => {
  assert.deepEqual(labels("3일", "토익 RC 필수 어휘"), ["단어암기 MP3 · 3일 파일"]);
  assert.ok(labels("진단고사 Part 1 기본다지기", "LC").includes("진단고사 MP3"));
  assert.deepEqual(labels("실전모의고사 1", "해커스 RC"), ["온라인 실전모의고사 (해커스토익)"]);
  assert.ok(!labels("Part 1 Part Test", "LC").some((l) => l.includes("모의고사")));
  assert.match(hackersUrl("rc", 8), /cate3_cd=727$/);
});
