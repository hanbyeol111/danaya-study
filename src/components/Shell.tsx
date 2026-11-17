"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { UIProvider } from "./ui";

type Me = { id: string; name: string; setName?: (n: string) => void };
const MeContext = createContext<Me | null>(null);
export const useMe = () => useContext(MeContext)!;

const TABS = [
  { href: "/", label: "홈" },
  { href: "/words", label: "단어장" },
  { href: "/book", label: "책" },
  { href: "/history", label: "기록" },
];
// 탭 바 없이 전체 화면으로 쓰는 경로
const FULL = ["/quiz", "/words/new", "/words/study", "/book/plan-new", "/book/note-new", "/settings"];

export default function Shell({ children }: { children: React.ReactNode }) {
  return <UIProvider><Gate>{children}</Gate></UIProvider>;
}

function Gate({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [state, setState] = useState<"loading" | "out" | "noname" | "in">("loading");
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return setState("out");
      const { data: p } = await supabase.from("profiles").select("id,name").eq("id", user.id).maybeSingle();
      if (p) {
        setMe(p);
        setState("in");
      } else {
        setMe({ id: user.id, name: "" });
        setState("noname");
      }
    };
    check();
    const { data } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN" || e === "SIGNED_OUT" || e === "USER_UPDATED") check();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (state === "out" && path !== "/login" && path !== "/help") router.replace("/login");
    // 이름을 아직 안 정한(noname) 첫 로그인도 로그인 화면을 떠나 이름 입력으로 간다
    if ((state === "in" || state === "noname") && path === "/login") router.replace("/");
  }, [state, path, router]);

  // 로그인 화면과 도움말은 로그인 없이 볼 수 있다
  if (path === "/login" || path === "/help") return <>{children}</>;
  if (state !== "in" && state !== "noname") return <div className="p-8 text-center text-l3">불러오는 중…</div>;
  if (state === "noname") return <NameForm userId={me!.id} onDone={(name) => { setMe({ id: me!.id, name }); setState("in"); }} />;

  const full = FULL.some((p) => path.startsWith(p));
  return (
    <MeContext.Provider value={{ ...me!, setName: (name) => setMe({ ...me!, name }) }}>
      <main className={`mx-auto w-full max-w-md flex-1 px-5 pt-[calc(env(safe-area-inset-top)+14px)] ${full ? "pb-10" : "pb-28"}`}>{children}</main>
      {!full && (
        <nav className="fixed inset-x-0 bottom-0 z-[5] border-t-[0.5px] border-sep bg-[rgba(249,249,249,0.94)] pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur-xl">
          <div className="mx-auto grid max-w-md grid-cols-4 px-2">
            {TABS.map((t) => {
              const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
              return (
                <Link key={t.href} href={t.href} className={`flex h-[50px] items-center justify-center text-[13px] ${active ? "font-semibold text-accent" : "font-medium text-l3"}`}>
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </MeContext.Provider>
  );
}

function NameForm({ userId, onDone }: { userId: string; onDone: (name: string) => void }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  return (
    <form
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-7 px-7 pb-12 pt-[120px]"
      onSubmit={async (e) => {
        e.preventDefault();
        const n = name.trim();
        if (!n) return;
        const { error } = await supabase.from("profiles").insert({ id: userId, name: n });
        if (error) setErr(error.message);
        else onDone(n);
      }}
    >
      <div className="flex flex-col gap-2.5">
        <div className="text-[26px] font-bold leading-[1.3]">처음 오셨네요.<br />뭐라고 부를까요?</div>
        <div className="text-[15px] text-l2">상대방 홈 화면에 이 이름으로 보여요</div>
      </div>
      <input className="field-lg h-14 text-lg" value={name} maxLength={10} onChange={(e) => setName(e.target.value)} placeholder="예: 한별" autoFocus />
      {err && <p className="text-sm text-bad-ink">{err}</p>}
      <div className="flex-1" />
      <button className="btn-primary" disabled={!name.trim()}>시작하기</button>
    </form>
  );
}
