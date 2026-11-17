"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Segment, TopBar } from "@/components/ui";

// 로그인 전에도 볼 수 있는 도움말 (Shell에서 /help는 로그인 없이 통과)
type Sec = { icon: string; title: string; items: (string | [string, string[]])[] };

const SECTIONS: Sec[] = [
  {
    icon: "👋", title: "처음 가입하기",
    items: [
      "로그인 화면에서 \"처음이에요 · 가입하기\"를 눌러요",
      "이메일과 비밀번호를 적고 가입해요. 인증 메일은 없어요",
      "부를 이름을 적으면 바로 시작! 비밀번호는 다시 로그인할 때 필요하니 기억해 두세요",
    ],
  },
  {
    icon: "🏠", title: "홈",
    items: [
      "맨 위 말풍선은 서로 남긴 응원 한 줄이에요. \"응원 남기기\"로 상대에게 보낼 수 있어요",
      "토익까지 남은 날(D-day)이 보여요",
      ["오늘의 분량", ["두 사람의 오늘 진도(%)가 같이 보여요", "\"이어서 하기\"를 누르면 오늘 단어 퀴즈가 시작돼요"]],
      ["오늘의 계획 (할 일 목록)", [
        "아래 칸에 할 일을 적으면 추가되고, 동그라미를 누르면 체크돼요",
        "책 계획에서 오늘 할 범위도 자동으로 들어와요",
        "할 일 밑의 ▶ 강의, ♪ MP3 버튼을 누르면 해커스 무료 강의·자료로 바로 가요",
      ]],
    ],
  },
  {
    icon: "📝", title: "단어 퀴즈",
    items: [
      ["3단계로 풀어요", ["① 뜻 맞히기: 영어를 보고 뜻 4개 중 고르기", "② 영어 맞히기: 뜻을 보고 영어로 직접 쓰기", "③ 복습: 전에 틀린 단어 다시 풀기"]],
      "틀린 단어는 1일 → 3일 → 7일 뒤에 다시 나와서 저절로 복습돼요",
      "▶ 버튼을 누르면 발음을 들려줘요. 소리가 안 나면 볼륨을 확인해 주세요",
      "단어와 오늘의 할 일을 다 끝내면 100% → 그날 연속 기록이 쌓여요 🔥",
    ],
  },
  {
    icon: "📚", title: "단어장",
    items: [
      ["📸 사진으로 단어 추가", [
        "단어장 페이지를 찍으면 단어·품사·뜻을 알아서 읽어 와요",
        "어느 단어장의 몇 번째 Day인지 고르고 찍으면 돼요",
        "\"오늘 공부할 분량으로 정하기\"에 체크하면 오늘 퀴즈 범위가 돼요",
        "저장 전에 사진과 똑같이 읽혔는지 꼭 확인하고, 틀린 건 직접 고쳐요",
      ]],
      ["단어장 안에서 외우는 방법 4가지", [
        "깜빡이: 단어·뜻이 자동으로 넘어가며 발음도 읽어줘요 (이동할 때 좋아요)",
        "플래시카드: 눌러서 뒤집어 보고 \"알아요 / 몰라요\"",
        "객관식: 알맞은 뜻 고르기",
        "받아쓰기: 발음을 듣고 영어로 쓰기",
      ]],
      "\"헷갈림\"만 골라 그것만 다시 공부할 수 있어요. 단어를 누르면 뜻·품사를 고칠 수 있어요",
      "단어장은 두 사람이 같이 써요. 누가 올려도 둘 다 보여요",
    ],
  },
  {
    icon: "📖", title: "책",
    items: [
      ["책 계획", [
        "\"+ 새 계획\"에서 책 목차나 책 앞쪽 \"해커스 학습 플랜\" 표를 찍으면 시험 일주일 전까지 날짜별로 나눠 줘요",
        "계획 안의 항목을 누르면 날짜를 바꿀 수 있어요. 밀렸으면 \"하루 미루기\", 미리 하고 싶으면 \"오늘\" (뒤 일정도 같이 옮겨줘요)",
        "많이 밀렸으면 \"다시 나누기\" 한 번으로 오늘부터 다시 짜요",
      ]],
      ["오답 노트", [
        "틀린 문제를 찍으면 문제와 보기를 읽어 와요. 내 답과 정답만 골라 주면 돼요",
        "\"다시 풀기\"로 틀린 문제만 다시 풀 수 있어요",
        "문제 아래에 해커스 책 몇 쪽을 다시 보면 되는지 나와요",
        "오답 노트는 나만 볼 수 있어요",
      ]],
      ["해커스 가이드 (책 탭 오른쪽 위)", [
        "파트별 출제 경향, 교재 몇 쪽을 보면 되는지, 내가 가장 많이 틀리는 파트를 알려줘요",
        "시험 일주일 전부터는 홈에 시험 준비물·시간표가 떠요",
      ]],
    ],
  },
  {
    icon: "📆", title: "기록",
    items: [
      "달력: 다 끝낸 날에 점이 찍혀요 (보라 = 나, 분홍 = 상대)",
      "둘 다 연속: 두 사람 모두 끝낸 날이 며칠째 이어지는지 보여요",
      "외운 단어 수와 정답률을 비교할 수 있어요. 맨 아래에 계정 정보와 로그아웃이 있어요",
    ],
  },
  {
    icon: "💡", title: "알아두면 좋은 것",
    items: [
      "홈 오른쪽 위 \"설정\"에서 이름, 시험일, 해커스 교재 판을 바꿀 수 있어요",
      "앱에 따로 넣을 키나 계정은 없어요. 이메일과 비밀번호만 있으면 돼요",
      "사진 인식이 가끔 틀릴 수 있어요. 저장 전에 한 번만 확인해 주세요",
    ],
  },
];

export default function HelpPage() {
  const router = useRouter();
  const [os, setOs] = useState<"ios" | "android">("ios");
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (/android/i.test(navigator.userAgent)) setOs("android");
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 pb-16 pt-[calc(env(safe-area-inset-top)+14px)]">
      <TopBar back="뒤로" onBack={() => (history.length > 1 ? router.back() : router.push("/"))} />
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- 작은 SVG 아이콘이라 최적화가 필요 없다 */}
        <img src="/icon.svg" alt="" className="size-14 rounded-[14px]" />
        <div className="flex flex-col gap-0.5">
          <div className="text-[26px] font-bold">도움말</div>
          <div className="text-sm text-l2">단아야 공부하자 · 둘이 같이, 매일 토익</div>
        </div>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl bg-card px-4 py-4">
        <div className="text-lg font-bold">📱 휴대폰 홈 화면에 앱으로 추가하기</div>
        {installed && <div className="rounded-xl bg-good-bg px-3 py-2 text-sm font-semibold text-good-ink">지금 앱으로 쓰고 있어요 ✓</div>}
        <Segment value={os} options={[["ios", "아이폰"], ["android", "안드로이드"]]} onChange={setOs} />
        {os === "ios" ? (
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-normal">
            <li>이 주소를 꼭 <b>사파리(Safari)</b>로 열어요. 카톡에서 열었다면 오른쪽 아래 메뉴 → &ldquo;Safari로 열기&rdquo;</li>
            <li>화면 아래 가운데 <b>공유 버튼</b>(네모에 위쪽 화살표 □↑)을 눌러요</li>
            <li>목록을 내려서 <b>&ldquo;홈 화면에 추가&rdquo;</b>를 눌러요</li>
            <li>오른쪽 위 <b>&ldquo;추가&rdquo;</b>를 누르면 끝!</li>
          </ol>
        ) : (
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-normal">
            <li>이 주소를 <b>크롬(Chrome)</b>으로 열어요</li>
            <li>오른쪽 위 <b>점 세 개(⋮)</b> 메뉴를 눌러요</li>
            <li><b>&ldquo;홈 화면에 추가&rdquo;</b> 또는 <b>&ldquo;앱 설치&rdquo;</b>를 누르고 &ldquo;추가&rdquo;</li>
          </ol>
        )}
        <div className="text-sm leading-normal text-l2">홈 화면에 파란 바탕 노란 별 ⭐ 아이콘이 생겨요. 이제 이걸 눌러 들어오면 돼요.</div>
        <div className="select-all rounded-xl bg-bg px-3 py-2 text-center text-[15px] font-semibold text-accent">https://danaya-study.vercel.app</div>
      </section>

      {SECTIONS.map((s) => (
        <section key={s.title} className="flex flex-col gap-2.5 rounded-2xl bg-card px-4 py-4">
          <div className="text-lg font-bold">{s.icon} {s.title}</div>
          <ul className="flex flex-col gap-2 text-[15px] leading-normal">
            {s.items.map((it) => typeof it === "string" ? (
              <li key={it} className="flex gap-2"><span className="text-l3">•</span><span>{it}</span></li>
            ) : (
              <li key={it[0]} className="flex flex-col gap-1">
                <span className="font-semibold">{it[0]}</span>
                <ul className="flex flex-col gap-1 pl-3 text-l4">{it[1].map((x) => <li key={x} className="flex gap-2"><span className="text-l3">-</span><span>{x}</span></li>)}</ul>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="pt-2 text-center text-sm text-l3">이상한 점이 있으면 화면을 캡처해서 알려 주세요 🙏</div>
    </div>
  );
}
