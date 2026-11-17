-- 002: 단어장(책) 단위 묶기, 품사, 자유 연습 기록, 해커스 교재 판.
-- 이미 schema.sql을 실행한 DB에서 SQL Editor로 한 번 실행한다. (새로 만드는 DB는 schema.sql만 실행)

create table word_books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 30),
  created_by uuid not null references profiles default auth.uid(),
  created_at timestamptz not null default now()
);
alter table word_books enable row level security;
create policy "read" on word_books for select to authenticated using (true);
create policy "both" on word_books for all to authenticated using (true) with check (true);

-- Day = word_sets 한 행. study_date는 '오늘 분량으로 정한 날'이라 정하기 전엔 비어 있다.
alter table word_sets add column book_id uuid references word_books on delete cascade;
alter table word_sets add column title text not null default '' check (char_length(title) <= 30);
alter table word_sets add column position int not null default 0;
alter table word_sets alter column study_date drop not null;
alter table word_sets alter column created_by set default auth.uid();

alter table words add column pos text not null default '' check (char_length(pos) <= 20);

-- practice: 단어장 화면의 플래시카드·객관식·받아쓰기. 오늘 진도에는 들어가지 않는다.
alter table attempts drop constraint attempts_mode_check;
alter table attempts add constraint attempts_mode_check check (mode in ('en2ko', 'ko2en', 'review', 'practice'));

alter table settings add column hackers_edition int not null default 9 check (hackers_edition in (8, 9));
