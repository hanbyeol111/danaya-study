import { supabase, must } from "./supabase";
import { todayKST, todaysReview, computeProgress, type Attempt, type Progress, type ReviewItem } from "./rules";

export type Word = { id: string; set_id: string; english: string; korean: string; position: number };
export type Profile = { id: string; name: string };
export type UserDay = {
  profile: Profile;
  progress: Progress;
  attempts: (Attempt & { user_id: string })[];
  reviewQueue: string[];
  reviewPassed: Set<string>;
};

/** 오늘 세트·두 사람의 오늘 진도를 한 번에 불러온다 */
export async function loadToday() {
  const today = todayKST();
  const [profiles, set, attempts, reviews] = await Promise.all([
    supabase.from("profiles").select("id,name").order("created_at").then(must),
    supabase.from("word_sets").select("id,study_date,words(id,set_id,english,korean,position)").eq("study_date", today).maybeSingle().then(must),
    supabase.from("attempts").select("user_id,word_id,mode,correct").eq("study_date", today).then(must),
    supabase.from("review_items").select("user_id,word_id,stage,due_date").lt("stage", 3).then(must),
  ]);
  const words = ((set?.words ?? []) as Word[]).sort((a, b) => a.position - b.position);
  const users: UserDay[] = (profiles as Profile[]).map((profile) => {
    const att = (attempts as UserDay["attempts"]).filter((a) => a.user_id === profile.id);
    const rv = todaysReview((reviews as (ReviewItem & { user_id: string })[]).filter((r) => r.user_id === profile.id), att, today);
    return {
      profile,
      attempts: att,
      reviewQueue: rv.queue,
      reviewPassed: rv.passed,
      progress: computeProgress(words.map((w) => w.id), att, rv.queue, rv.passed),
    };
  });
  return { today, setId: (set?.id as string | undefined) ?? null, words, users };
}

/** 100%가 된 날을 기록 (연속 출석용). 이미 있으면 무시 */
export async function markComplete(userId: string, date: string) {
  await supabase.from("completions").upsert({ user_id: userId, study_date: date }, { ignoreDuplicates: true });
}

export async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
