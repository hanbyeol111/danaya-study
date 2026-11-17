import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  // 화면들이 effect 안에서 Supabase를 불러와 상태를 채우는 구조라 끈다
  { rules: { "react-hooks/set-state-in-effect": "off" } },
  { files: ["src/app/apple-icon.tsx"], rules: { "@next/next/no-img-element": "off" } },
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
