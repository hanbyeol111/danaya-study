import { checkImages, extractJson, fail, requireUser, validateToc } from "@/lib/server";

const TOC = `토익 책의 목차 사진입니다. 사진에 실제로 있는 목차 항목만 순서대로 옮기세요.
형식: [{"title": "Day 1 명사", "page": 12}]
- 하루에 공부할 단위(Day, Unit, Chapter 등)를 항목으로 하고, 그 아래 세부 소제목은 넣지 마세요.
- 쪽 번호가 없으면 page는 null.
- 정답, 해설, 부록 항목은 넣지 마세요. 사진에 없는 항목을 지어내지 마세요.
- title은 40자 이내로.`;

const PLAN = `토익 책의 '학습 플랜' 표 사진입니다. 1st week 1st Day부터 날짜 순서대로, 칸 하나를 항목 하나로 옮기세요.
형식: [{"day": 1, "title": "Part 1 Course 1-1~Hackers Test", "page": 56}]
- day는 플랜의 몇 번째 날인지(1st week 1st Day = 1, 2nd week 1st Day = 8). 같은 날에 칸이 여러 개면(예: Grammar와 Vocabulary 줄) 같은 day로 각각 넣으세요.
- 줄 이름(Grammar, Vocabulary, Reading 등)이 있으면 title 앞에 붙이세요. 예: "Grammar Ch 3", "Vocabulary Ch 2".
- page는 칸에 적힌 쪽 범위의 첫 쪽. 없으면 null.
- 빈 칸은 넣지 마세요. 사진에 없는 내용을 지어내지 마세요. title은 40자 이내로.
- 플랜이 여러 개(A, B) 보이면 사진에서 더 크게 보이거나 먼저 나오는 플랜 하나만 옮기세요.`;

export async function POST(req: Request) {
  if (!(await requireUser(req))) return fail("로그인이 필요해요", 401);
  const body = await req.json().catch(() => ({}));
  const images = checkImages(body.images, 5);
  if (typeof images === "string") return fail(images);
  try {
    return Response.json({ items: await extractJson(images, body.mode === "plan" ? PLAN : TOC, validateToc) });
  } catch (e) {
    return fail((e as Error).message, 502);
  }
}
