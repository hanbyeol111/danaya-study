import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS 홈 화면 아이콘 (PNG 필요). public/icon.svg를 그대로 그린다
export default async function AppleIcon() {
  // iOS가 모서리를 알아서 둥글게 깎으므로 꽉 찬 사각형으로 그린다
  const svg = (await readFile(join(process.cwd(), "public/icon.svg"), "utf8")).replace(' rx="112"', "");
  return new ImageResponse(
    <img src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`} width={180} height={180} alt="" />,
    size,
  );
}
