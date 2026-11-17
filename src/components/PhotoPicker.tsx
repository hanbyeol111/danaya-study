"use client";

import { useState } from "react";
import { api } from "@/lib/supabase";
import { resizeImage } from "@/lib/browser";

/** 사진 고르기 → 줄이기 → 서버 추출. 결과를 onResult로 넘긴다 */
export default function PhotoPicker<T>({ endpoint, max, label, onResult }: { endpoint: string; max: number; label: string; onResult: (r: T) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <label className={`btn-primary block cursor-pointer text-center ${busy ? "opacity-50" : ""}`}>
        {busy ? "사진 읽는 중… (10~30초)" : label}
        <input
          type="file" accept="image/*" capture="environment" multiple={max > 1} className="hidden" disabled={busy}
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (!files.length) return;
            if (files.length > max) return setErr(`사진은 최대 ${max}장까지 올릴 수 있어요`);
            setErr("");
            setBusy(true);
            try {
              const images = await Promise.all(files.map((f) => resizeImage(f)));
              onResult(await api<T>(endpoint, { images }));
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {max > 1 && <p className="text-center text-xs text-muted">여러 장(최대 {max}장)을 한 번에 고를 수 있어요</p>}
      {err && <p className="text-sm text-bad">{err}</p>}
    </div>
  );
}
