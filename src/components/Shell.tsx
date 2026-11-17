"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Me = { id: string; name: string; setName?: (n: string) => void };
const MeContext = createContext<Me | null>(null);
export const useMe = () => useContext(MeContext)!;

const TABS = [
  { href: "/", label: "홈", icon: "🏠" },
  { href: "/words", label: "단어장", icon: "📒" },
  { href: "/book", label: "책", icon: "📚" },
  { href: "/history", label: "기록", icon: "📅" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
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
    if (state === "out" && path !== "/login") router.replace("/login");
    if (state === "in" && path === "/login") router.replace("/");
  }, [state, path, router]);

  if (path === "/login") return <>{children}</>;
  if (state !== "in" && state !== "noname") return <div className="p-8 text-center text-muted">불러오는 중…</div>;
  if (state === "noname") return <NameForm userId={me!.id} onDone={(name) => { setMe({ id: me!.id, name }); setState("in"); }} />;

  const hideTabs = path.startsWith("/quiz");
  return (
    <MeContext.Provider value={{ ...me!, setName: (name) => setMe({ ...me!, name }) }}>
      <main className={`mx-auto w-full max-w-md flex-1 px-4 pt-4 ${hideTabs ? "pb-8" : "pb-24"}`}>{children}</main>
      {!hideTabs && (
        <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex max-w-md">
            {TABS.map((t) => {
              const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
              return (
                <Link key={t.href} href={t.href} className={`flex flex-1 flex-col items-center py-2 text-xs ${active ? "font-bold text-accent" : "text-muted"}`}>
                  <span className="text-xl" aria-hidden>{t.icon}</span>
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
      className="mx-auto flex w-full max-w-md flex-col gap-3 p-6 pt-16"
      onSubmit={async (e) => {
        e.preventDefault();
        const n = name.trim();
        if (!n) return;
        const { error } = await supabase.from("profiles").insert({ id: userId, name: n });
        if (error) setErr(error.message);
        else onDone(n);
      }}
    >
      <h1 className="text-2xl font-bold">반가워요!</h1>
      <p className="text-muted">앱에서 보일 이름을 정해 주세요.</p>
      <input className="input" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="예: 단아" autoFocus />
      {err && <p className="text-sm text-bad">{err}</p>}
      <button className="btn-primary">시작하기</button>
    </form>
  );
}
