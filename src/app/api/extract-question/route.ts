import { checkImages, extractJson, fail, requireUser, validateQuestion } from "@/lib/server";

const PROMPT = `토익 문제집 사진입니다. 사진에 실제로 있는 글자만 옮기세요.
형식: {"part": 5, "question": "문제 문장 또는 지문", "choices": ["(A) ...", "(B) ...", "(C) ...", "(D) ..."]}
- 토익 Part(1~7)를 알 수 없으면 part는 null.
- 사진에 문제가 여러 개면 첫 문제만 옮기세요.
- 보기가 없으면 choices는 빈 배열.
- 정답이나 해설은 넣지 마세요. 사진에 없는 내용을 지어내지 마세요.`;

export async function POST(req: Request) {
  if (!(await requireUser(req))) return fail("로그인이 필요해요", 401);
  const images = checkImages((await req.json().catch(() => ({}))).images, 1);
  if (typeof images === "string") return fail(images);
  try {
    return Response.json(await extractJson(images, PROMPT, validateQuestion));
  } catch (e) {
    return fail((e as Error).message, 502);
  }
}
