import { admin, allowedEmails, fail } from "@/lib/server";

// 허용된 이메일만 계정을 만든다. (대시보드에서 공개 가입은 꺼 둔다)
export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!allowedEmails().includes(e)) return fail("초대된 사용자만 쓸 수 있어요", 403);
  if (typeof password !== "string" || password.length < 8) return fail("비밀번호는 8자 이상이어야 해요");
  const { error } = await admin().auth.admin.createUser({ email: e, password, email_confirm: true });
  if (error) return fail(error.message.includes("already") ? "이미 가입된 이메일이에요. 로그인해 주세요." : error.message);
  return Response.json({ ok: true });
}
