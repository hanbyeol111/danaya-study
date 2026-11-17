import { test } from "node:test";
import assert from "node:assert/strict";
import { kindOf, picksFor, hackersUrl } from "./hackers.ts";

test("kindOf: 책 이름으로 LC/RC 구분", () => {
  assert.equal(kindOf("해커스 토익 LISTENING"), "lc");
  assert.equal(kindOf("해커스 RC"), "rc");
  assert.equal(kindOf("해커스 보카"), null);
});

test("picksFor: 범위 제목으로 자료 고르기", () => {
  assert.deepEqual(picksFor("lc", "진단고사"), ["진단고사 MP3", "진단고사 해설강의"]);
  assert.deepEqual(picksFor("rc", "Actual Test 1"), ["온라인 모의고사"]);
  assert.equal(picksFor("lc", "Part 2 Ch.3")[0], "문제풀이 MP3");
  assert.match(hackersUrl("rc", 8), /cate3_cd=727$/);
});
