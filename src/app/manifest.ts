import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "단아야 공부하자",
    short_name: "단아야 공부하자",
    description: "둘이 같이 매일 토익 단어 외우기",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf7f2",
    theme_color: "#e8664a",
    lang: "ko",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
