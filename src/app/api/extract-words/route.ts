import { checkImages, extractJson, fail, requireUser, validateWords } from "@/lib/server";

const PROMPT = `토익 단어장 사진입니다. 사진에 실제로 있는 영어 단어와 그 한국어 뜻만 순서대로 옮기세요.
형식: [{"english": "allocate", "korean": "할당하다, 배분하다"}]
- 뜻이 사진에 없으면 korean을 빈 문자열("")로 두세요. 절대 뜻을 지어내지 마세요.
- 예문, 번호, 발음기호, 페이지 표시는 무시하세요.`;

export async function POST(req: Request) {
  if (!(await requireUser(req))) return fail("로그인이 필요해요", 401);
  const images = checkImages((await req.json().catch(() => ({}))).images, 5);
  if (typeof images === "string") return fail(images);
  try {
    return Response.json({ words: await extractJson(images, PROMPT, validateWords) });
  } catch (e) {
    return fail((e as Error).message, 502);
  }
}
