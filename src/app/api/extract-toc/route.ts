import { checkImages, extractJson, fail, requireUser, validateToc } from "@/lib/server";

const PROMPT = `토익 책의 목차 사진입니다. 사진에 실제로 있는 목차 항목만 순서대로 옮기세요.
형식: [{"title": "Day 1 명사", "page": 12}]
- 하루에 공부할 단위(Day, Unit, Chapter 등)를 항목으로 하고, 그 아래 세부 소제목은 넣지 마세요.
- 쪽 번호가 없으면 page는 null.
- 정답, 해설, 부록 항목은 넣지 마세요. 사진에 없는 항목을 지어내지 마세요.
- title은 40자 이내로.`;

export async function POST(req: Request) {
  if (!(await requireUser(req))) return fail("로그인이 필요해요", 401);
  const images = checkImages((await req.json().catch(() => ({}))).images, 5);
  if (typeof images === "string") return fail(images);
  try {
    return Response.json({ items: await extractJson(images, PROMPT, validateToc) });
  } catch (e) {
    return fail((e as Error).message, 502);
  }
}
