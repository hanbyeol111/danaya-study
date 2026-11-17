# 단아야 공부하자

한별·단아 두 사람이 2027년 2월 토익 전까지 매일 단어를 외우고, 서로의 진도를 보는 웹앱. 명세는 [SPEC.md](SPEC.md).

단아(사용자)는 Claude 계정이 필요 없다. 휴대폰 브라우저와 가입할 이메일만 있으면 된다.

## 처음 한 번 설정 (한별)

1. **Supabase** (무료): https://supabase.com 에서 새 프로젝트를 만든다. 지역은 Seoul 추천.
   - SQL Editor에서 [supabase/schema.sql](supabase/schema.sql) 내용을 붙여 넣고 실행. (예전에 schema.sql을 이미 실행했다면 [migrate-002-wordbooks.sql](supabase/migrate-002-wordbooks.sql)만 실행)
   - Authentication → Sign In / Providers → "Allow new users to sign up" **켜기**, **"Confirm email" 끄기** (가입하면 인증 메일 없이 바로 로그인).
   - Project Settings → API Keys에서 URL과 **publishable 키**만 복사. 비밀(secret) 키는 쓰지 않는다.
2. **사진 인식 키**: 학교 챗쿠(BAZE) API 게이트웨이 https://chat.khu.ac.kr/dashboard/developers 에서 키를 만들어 `LLM_API_KEY`에 넣는다. `LLM_BASE_URL`, `LLM_MODEL`은 [.env.example](.env.example) 값 그대로. (Anthropic 키를 직접 쓰면 이 둘은 비운다)
3. 이 폴더에 `.env.local`을 만들고 [.env.example](.env.example)처럼 채운다.
4. 로컬 실행: `npm install` → `npm run dev` → http://localhost:3000
5. **배포**: GitHub에 올리고 https://vercel.com 에서 가져오기 → Environment Variables에 `.env.local`과 같은 5개를 넣고 Deploy.
6. 두 사람 각자 배포 주소에서 "처음이에요 → 가입하기" → 이름 입력. 휴대폰 브라우저 메뉴의 "홈 화면에 추가"로 앱처럼 쓴다.

## 개발

- `npm test` — 진도율·복습·연속 출석·책 계획 나누기 규칙 테스트 (`src/lib/rules.ts`)
- `npm run lint`, `npm run build`
