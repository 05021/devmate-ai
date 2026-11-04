import type { Config } from "tailwindcss";

/**
 * DevMate AI 极简黑白设计系统
 * 所有色系按原始明度重映射到中性灰阶：
 * - teal（原主色）→ 黑阶，teal-700 用作主按钮/强调（近纯黑）
 * - slate/gray/zinc 等 → neutral 灰阶
 * - emerald/rose/amber/red 等状态色 → 灰阶（状态靠文字与明度层级区分）
 */
const NEUTRAL: Record<string, string> = {
  50: "#fafafa",
  100: "#f5f5f5",
  200: "#e5e5e5",
  300: "#d4d4d4",
  400: "#a3a3a3",
  500: "#737373",
  600: "#525252",
  700: "#404040",
  800: "#262626",
  900: "#171717",
  950: "#0a0a0a"
};

const mono = (overrides: Record<string, string> = {}): Record<string, string> => ({
  ...NEUTRAL,
  ...overrides
});

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#111111",
        panel: "#ffffff",
        line: "#e5e5e5",
        accent: "#111111",
        warn: "#525252",
        teal: mono({
          50: "#f5f5f5",
          100: "#ececec",
          200: "#dcdcdc",
          300: "#c2c2c2",
          400: "#8f8f8f",
          500: "#5c5c5c",
          600: "#3f3f3f",
          700: "#171717",
          800: "#111111",
          900: "#0a0a0a"
        }),
        slate: mono(),
        gray: mono(),
        zinc: mono(),
        neutral: mono(),
        stone: mono(),
        emerald: mono({ 700: "#333333" }),
        green: mono(),
        rose: mono({ 700: "#262626" }),
        red: mono({ 700: "#262626" }),
        amber: mono(),
        yellow: mono(),
        orange: mono(),
        sky: mono(),
        blue: mono(),
        cyan: mono(),
        indigo: mono(),
        violet: mono(),
        purple: mono(),
        fuchsia: mono(),
        pink: mono(),
        lime: mono()
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Helvetica Neue"',
          "Arial",
          "sans-serif"
        ],
        mono: ['"JetBrains Mono"', "Consolas", '"Liberation Mono"', "Menlo", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
