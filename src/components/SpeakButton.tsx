"use client";

import { speak } from "@/lib/browser";

export default function SpeakButton({ text }: { text: string }) {
  return (
    <button type="button" aria-label={`${text} 발음 듣기`} className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1.5 text-base" onClick={() => speak(text)}>
      🔊
    </button>
  );
}
