import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const fail = (error: string, status = 400) => Response.json({ error }, { status });

/** Authorization 헤더의 토큰으로 로그인 사용자를 확인한다 (공개 키로 충분) */
export async function requireUser(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return null;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data } = await sb.auth.getUser(token);
  return data.user ?? null;
}

const MODEL = "claude-sonnet-5-5";
const MAX_BYTES = 5 * 1024 * 1024;

/** base64 JPEG 검사: 개수·크기 */
export function checkImages(images: unknown, maxCount: number): string[] | string {
  if (!Array.isArray(images) || images.length < 1 || images.length > maxCount) return `사진은 1~${maxCount}장이어야 해요`;
  for (const img of images) {
    if (typeof img !== "string" || (img.length * 3) / 4 > MAX_BYTES) return "사진 한 장은 5MB 이하여야 해요";
  }
  return images as string[];
}

/** 이미지 + 지시문을 보내고 JSON만 받는다. 파싱 실패 시 1회 재시도. */
export async function extractJson<T>(images: string[], instruction: string, validate: (v: unknown) => T | null): Promise<T> {
  const client = new Anthropic({ apiKey: process.env.LLM_API_KEY });
  for (let attempt = 0; attempt < 2; attempt++) {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: [
          ...images.map((data) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data } })),
          { type: "text" as const, text: instruction + "\n\n설명이나 코드블록 없이 JSON만 출력하세요." },
        ],
      }],
    });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    try {
      const json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim());
      const ok = validate(json);
      if (ok) return ok;
    } catch {}
  }
  throw new Error("사진을 읽지 못했어요. 다시 찍어 주세요.");
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export const validateWords = (v: unknown) =>
  Array.isArray(v) ? v.map((w) => ({ english: str(w?.english, 100), korean: str(w?.korean, 200) })).filter((w) => w.english) : null;

export const validateQuestion = (v: unknown) => {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const part = typeof o.part === "number" && o.part >= 1 && o.part <= 7 ? o.part : null;
  const choices = Array.isArray(o.choices) ? o.choices.map((c) => str(c, 300)).filter(Boolean) : [];
  return { part, question: str(o.question, 3000), choices };
};

export const validateToc = (v: unknown) =>
  Array.isArray(v)
    ? v.map((u) => ({ title: str(u?.title, 40), page: Number.isInteger(u?.page) ? (u.page as number) : null })).filter((u) => u.title)
    : null;
