/** 긴 변 1600px 이하 JPEG로 줄여 base64(접두사 없음)로 돌려준다 */
export async function resizeImage(file: File, max = 1600): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}

export function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

export function fmtDate(d: string) {
  const [, m, day] = d.split("-").map(Number);
  return `${m}월 ${day}일`;
}

/** "11월 17일 (화)" */
export function dayLabel(d: string) {
  return `${fmtDate(d)} (${"일월화수목금토"[new Date(d + "T00:00:00Z").getUTCDay()]})`;
}

/** timestamptz → 한국 날짜 'YYYY-MM-DD' */
export const kstDate = (ts: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(ts));

/** 홈 진도율 표시: 100%가 아니면 최대 99% */
export const pctOf = (ratio: number) => (ratio >= 1 ? 100 : Math.min(99, Math.round(ratio * 100)));
