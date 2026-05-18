// tailwind.config.ts
// MemoRy — Circuit Memory 設計系統 Token
// 適用於：artifacts/web-dashboard 和 artifacts/chrome-ext

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../lib/**/*.{ts,tsx}",
  ],
  darkMode: "class", // 預設暗色模式，在 <html> 加 class="dark"
  theme: {
    extend: {
      // ─────────────────────────────────────────────
      // 背景色
      // ─────────────────────────────────────────────
      colors: {
        void:    "#090C14",   // 最深背景（Popup、Modal 遮罩）
        surf: {
          0:     "#0F1219",   // 主背景（Dashboard 主區）
          1:     "#0C1220",   // Sidebar 背景
          2:     "#161A28",   // 卡片預設背景
          3:     "#1C2134",   // 卡片 Hover / Active 背景
        },

        // ─────────────────────────────────────────
        // 品牌雙色（取樣自 MemoRy Logo.png）
        // ─────────────────────────────────────────
        signal: {
          DEFAULT: "#5B7AE0", // Signal Blue（主要互動色）
          dark:    "#2E4DB0", // Pixel Blue（深，用於碎片元素）
          light:   "#7B96F0", // Blue Hover
          dim:     "rgba(91,122,224,0.10)", // 標籤背景
          border:  "rgba(91,122,224,0.40)", // 標籤邊框
        },
        circuit: {
          DEFAULT: "#8B7AE0", // Circuit Purple（AI 輸出類）
          light:   "#A898F0", // Purple Hover
          dim:     "rgba(139,122,224,0.10)",
          border:  "rgba(139,122,224,0.40)",
        },

        // ─────────────────────────────────────────
        // 語意色
        // ─────────────────────────────────────────
        done:    "#34D4A8",  // ✦ AI 完成（磷光青綠）
        pending: "#F0A030",  // ■ AI 處理中（琥珀）
        failed:  "#F05068",  // ✕ 失敗（鮮紅）

        // ─────────────────────────────────────────
        // 文字色
        // ─────────────────────────────────────────
        text: {
          hi:  "#DFE4F0",  // 主要文字（標題、重要內容）
          mid: "#8A96B2",  // 次要文字（摘要、說明）
          lo:  "#4A5272",  // 輔助文字（時間戳、domain）
        },

        // ─────────────────────────────────────────
        // 邊框（藍調，非純灰）
        // ─────────────────────────────────────────
        line: {
          faint: "rgba(88,100,160,0.13)",  // 一般卡片邊框
          mid:   "rgba(88,100,160,0.32)",  // Hover / Focus
          sel:   "rgba(91,122,224,0.60)",  // Selected / Focus-ring
        },
      },

      // ─────────────────────────────────────────────
      // 字體
      // ─────────────────────────────────────────────
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Noto Sans TC", "sans-serif"],
        mono: ["Courier New", "Courier", "monospace"],
      },

      // ─────────────────────────────────────────────
      // 字級
      // ─────────────────────────────────────────────
      fontSize: {
        "display":  ["20px", { fontWeight: "700", letterSpacing: "-0.025em" }],
        "heading":  ["15px", { fontWeight: "600", letterSpacing: "-0.01em" }],
        "body":     ["13px", { fontWeight: "400", lineHeight: "1.7" }],
        "body-ai":  ["13px", { fontWeight: "400", lineHeight: "1.8" }],
        "caption":  ["11px", { fontWeight: "400" }],
        "label":    ["9px",  { fontWeight: "700", letterSpacing: "0.04em" }],
        "mono-url": ["12px", { fontFamily: "Courier New" }],
      },

      // ─────────────────────────────────────────────
      // 間距
      // ─────────────────────────────────────────────
      spacing: {
        "xs": "4px",
        "sm": "8px",
        "md": "12px",
        "lg": "16px",   // 卡片內距
        "xl": "20px",
        "2xl": "24px",
        "3xl": "32px",
      },

      // ─────────────────────────────────────────────
      // 圓角
      // ─────────────────────────────────────────────
      borderRadius: {
        "tag":   "4px",   // Tag badge
        "input": "7px",   // 輸入框、按鈕
        "card":  "10px",  // 卡片
        "popup": "14px",  // Popup 主體
        "icon":  "7px",   // Logo 圖標容器
      },

      // ─────────────────────────────────────────────
      // 動畫（Circuit Memory 品牌動畫）
      // ─────────────────────────────────────────────
      keyframes: {
        // Pixel 碎片漂移（Pending 狀態）
        pxdrift: {
          "0%, 100%": { opacity: "1", transform: "translate(0, 0)" },
          "60%":      { opacity: "0.2", transform: "translate(1px, -1px)" },
        },
        // Scan sweep（Pending 卡片掃描光）
        sweep: {
          "0%":   { left: "-120%" },
          "100%": { left: "160%" },
        },
        // Shimmer（Skeleton 載入）
        shimmer: {
          "0%, 100%": { opacity: "0.4" },
          "50%":      { opacity: "0.7" },
        },
        // Star 出現（Done 狀態切換）
        starAppear: {
          "0%":   { opacity: "0", transform: "scale(0)" },
          "60%":  { transform: "scale(1.2)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        // Pending dot pulse（備用，非主要）
        dpulse: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.2" },
        },
      },
      animation: {
        pxdrift:    "pxdrift 2.2s ease-in-out infinite",
        sweep:      "sweep 2.8s ease-in-out infinite",
        shimmer:    "shimmer 1.8s ease-in-out infinite",
        starAppear: "starAppear 0.35s ease-out forwards",
        dpulse:     "dpulse 1.5s ease-in-out infinite",
      },

      // ─────────────────────────────────────────────
      // 陰影
      // ─────────────────────────────────────────────
      boxShadow: {
        "card":  "0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)",
        "modal": "0 20px 60px rgba(0,0,0,0.5)",
        "popup": "0 4px 24px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
