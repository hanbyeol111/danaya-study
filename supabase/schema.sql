-- 단아야 공부하자 — Supabase SQL Editor에서 한 번 실행한다.

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  created_at timestamptz not null default now()
);

create table settings (
  id int primary key default 1 check (id = 1),
  exam_date date not null default '2027-02-28'
);
insert into settings (id) values (1);

create table word_sets (
  id uuid primary key default gen_random_uuid(),
  study_date date not null unique,
  created_by uuid not null references profiles,
  created_at timestamptz not null default now()
);

create table words (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references word_sets on delete cascade,
  english text not null check (char_length(english) between 1 and 100),
  korean text not null check (char_length(korean) between 1 and 200),
  position int not null
);
create index on words (set_id);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles default auth.uid(),
  word_id uuid not null references words on delete cascade,
  mode text not null check (mode in ('en2ko', 'ko2en', 'review')),
  correct boolean not null,
  study_date date not null,
  created_at timestamptz not null default now()
);
create index on attempts (user_id, study_date);

create table review_items (
  user_id uuid not null references profiles default auth.uid(),
  word_id uuid not null references words on delete cascade,
  stage int not null default 0 check (stage between 0 and 3),
  due_date date not null,
  primary key (user_id, word_id)
);

create table cheers (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references profiles default auth.uid(),
  message text not null check (char_length(message) between 1 and 60),
  created_at timestamptz not null default now()
);

create table book_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles default auth.uid(),
  book_title text not null check (char_length(book_title) between 1 and 30),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  created_at timestamptz not null default now()
);

create table book_units (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles default auth.uid(),
  plan_id uuid references book_plans on delete cascade,
  position int not null default 0,
  title text not null check (char_length(title) between 1 and 40),
  page int,
  scheduled_date date not null,
  done boolean not null default false,
  done_date date
);
create index on book_units (user_id, scheduled_date);

create table wrong_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles default auth.uid(),
  part int check (part between 1 and 7),
  source text not null default '',
  question text not null default '',
  choices text[] not null default '{}',
  my_answer text not null default '',
  correct_answer text not null check (char_length(correct_answer) >= 1),
  memo text not null default '',
  solved boolean not null default false,
  created_at timestamptz not null default now()
);

-- 진도율 100%를 처음 찍은 날 클라이언트가 1행 기록한다. 연속 출석 계산용.
-- (지난날의 복습 대상 수 R은 attempts만으로 되살릴 수 없어서 완료 사실만 남긴다)
create table completions (
  user_id uuid not null references profiles default auth.uid(),
  study_date date not null,
  primary key (user_id, study_date)
);

-- RLS: 로그인한 사용자는 모두 읽기. 쓰기는 자기 행만. 단어장·설정은 둘 다 쓰기.
-- 가입 자체는 서버(/api/signup)가 허용 이메일만 만들고, 대시보드에서 공개 가입을 끈다.
do $$
declare t text;
begin
  foreach t in array array['profiles','settings','word_sets','words','attempts','review_items','cheers','book_plans','book_units','wrong_notes','completions'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "read" on %I for select to authenticated using (true)', t);
  end loop;
end $$;

create policy "own" on profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "both" on settings for update to authenticated using (true) with check (true);
create policy "both" on word_sets for all to authenticated using (true) with check (true);
create policy "both" on words for all to authenticated using (true) with check (true);
create policy "own" on attempts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on review_items for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on cheers for all to authenticated using (from_user = auth.uid()) with check (from_user = auth.uid());
create policy "own" on book_plans for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on book_units for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- A6: 오답 노트는 자기 것만 본다
drop policy "read" on wrong_notes;
create policy "own" on wrong_notes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on completions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
