"use client";

import { useState } from "react";

/** 찍은 사진 가로 줄 (탭하면 크게). 확인·수정 화면에서 원본과 비교용. photos는 base64 */
export function PhotoStrip({ photos }: { photos: string[] }) {
  const [big, setBig] = useState<string | null>(null);
  if (!photos.length) return null;
  const src = (p: string) => `data:image/jpeg;base64,${p}`;
  return (
    <>
      <div className="-mx-5 flex shrink-0 gap-2 overflow-x-auto px-5 pb-1">
        {photos.map((p, i) => (
          <button key={i} type="button" onClick={() => setBig(p)} className="shrink-0 border-0 bg-transparent p-0" aria-label={`사진 ${i + 1} 크게 보기`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(p)} alt={`찍은 사진 ${i + 1}`} className="h-36 rounded-xl bg-g5 object-contain" />
          </button>
        ))}
      </div>
      {big && (
        <button type="button" className="fixed inset-0 z-50 flex items-center justify-center border-0 bg-black/85 p-2" onClick={() => setBig(null)} aria-label="닫기">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src(big)} alt="찍은 사진" className="max-h-full max-w-full object-contain" />
        </button>
      )}
    </>
  );
}

/**
 * 사진 인식 직후 단계: 사진과 읽은 결과를 나란히 보여 주고 "맞나요?"를 묻는다.
 * 맞으면 onYes, 틀린 곳이 있으면 onFix(직접 고치는 화면으로).
 */
export default function PhotoCheck({
  photos, count, children, onYes, onFix, yesLabel = "네, 맞아요", blockReason,
}: {
  photos: string[];
  count: string;
  children: React.ReactNode;
  onYes: () => void;
  onFix: () => void;
  yesLabel?: string;
  blockReason?: string; // 있으면 "맞아요"를 막고 이유를 보여 준다
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5 pb-3.5 pt-1">
        <div className="text-2xl font-bold">사진과 똑같이 읽혔나요? <span className="text-lg font-semibold text-l3">{count}</span></div>
        <div className="text-sm leading-normal text-l2">사진(탭하면 크게)과 비교해 주세요. 틀린 글자나 빠진 것, 사진에 없는데 들어간 것이 있으면 직접 고쳐요.</div>
      </div>
      <PhotoStrip photos={photos} />
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-2xl bg-card px-4 py-1">{children}</div>
      <div className="flex flex-col gap-2 pt-3">
        {blockReason && <div className="text-center text-sm text-bad-ink">{blockReason}</div>}
        <button className="btn-primary" disabled={!!blockReason} onClick={onYes}>{yesLabel}</button>
        <button className="btn-secondary" onClick={onFix}>아니요, 고칠게요</button>
      </div>
    </>
  );
}
