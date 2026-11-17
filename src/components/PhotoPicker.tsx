"use client";

import { resizeImage } from "@/lib/browser";

/** 고른 파일들을 1600px JPEG(base64, 접두사 없음)로 */
const toJpeg = (files: FileList | null, room: number) => Promise.all(Array.from(files ?? []).slice(0, room).map((f) => resizeImage(f)));

/** 숨긴 파일 입력을 감싼 라벨 버튼. camera=true면 바로 카메라 */
export function PhotoInput({ camera, multiple, room, onAdd, className, children }: {
  camera?: boolean; multiple?: boolean; room: number; onAdd: (imgs: string[]) => void; className: string; children: React.ReactNode;
}) {
  return (
    <label className={`cursor-pointer ${className}`}>
      {children}
      <input
        type="file" accept="image/*" className="hidden" multiple={multiple} {...(camera ? { capture: "environment" as const } : {})}
        onChange={async (e) => {
          const imgs = await toJpeg(e.target.files, room);
          e.target.value = "";
          if (imgs.length) onAdd(imgs);
        }}
      />
    </label>
  );
}

/** "사진 찍기 / 앨범에서 고르기" 두 버튼 */
export function PhotoButtons({ room, multiple, onAdd }: { room: number; multiple?: boolean; onAdd: (imgs: string[]) => void }) {
  return (
    <div className="flex w-full gap-2.5">
      <PhotoInput camera room={room} onAdd={onAdd} className="flex h-14 flex-1 items-center justify-center rounded-[14px] bg-accent text-base font-[650] text-white">사진 찍기</PhotoInput>
      <PhotoInput multiple={multiple} room={room} onAdd={onAdd} className="flex h-14 flex-1 items-center justify-center rounded-[14px] border border-g3 bg-card text-base font-semibold">앨범에서 고르기</PhotoInput>
    </div>
  );
}

/** 고른 사진 3열 그리드 (✕로 빼기) */
export function PhotoGrid({ photos, onDel, alt, children }: { photos: string[]; onDel?: (i: number) => void; alt: string; children?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((p, i) => (
        <div key={i} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-g5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/jpeg;base64,${p}`} alt={`${alt} ${i + 1}`} className="size-full object-cover" />
          {onDel && (
            <button onClick={() => onDel(i)} aria-label={`${alt} ${i + 1} 빼기`} className="absolute right-1 top-1 size-8 rounded-full border-0 bg-black/70 text-[13px] text-white">✕</button>
          )}
        </div>
      ))}
      {children}
    </div>
  );
}
