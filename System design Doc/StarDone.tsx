// StarDone.tsx
// MemoRy 品牌元件 — ✦ 四芒星（Done 態指示）
// 靈感：MemoRy Logo 中心的四芒星，代表「AI 完成處理的轉化瞬間」

import React, { useEffect, useState } from "react";

interface StarDoneProps {
  /** 字體大小，預設 11 */
  size?: number;
  /** 顏色，預設 Done 磷光綠 */
  color?: string;
  /** 是否播放出現動畫（用於 pending→done 切換），預設 false */
  appear?: boolean;
  /** 自訂 className */
  className?: string;
  /** aria label */
  label?: string;
}

// 四芒星 SVG 路徑（相比 Unicode ✦ 更精確可控）
// viewBox 20×20，中心 (10,10)
function StarShape({ size, color }: { size: number; color: string }) {
  // 四芒星：上下左右各一尖，帶內縮
  const cx = 10, cy = 10;
  const outer = 8;   // 尖端距中心
  const inner = 2.5; // 凹陷距中心

  const points = [
    // 上尖
    `${cx},${cy - outer}`,
    `${cx + inner},${cy - inner}`,
    // 右尖
    `${cx + outer},${cy}`,
    `${cx + inner},${cy + inner}`,
    // 下尖
    `${cx},${cy + outer}`,
    `${cx - inner},${cy + inner}`,
    // 左尖
    `${cx - outer},${cy}`,
    `${cx - inner},${cy - inner}`,
  ].join(" ");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill={color}
      aria-hidden="true"
      style={{ display: "inline-block", flexShrink: 0 }}
    >
      <polygon points={points} />
    </svg>
  );
}

export default function StarDone({
  size = 11,
  color = "#34D4A8",
  appear = false,
  className = "",
  label = "AI 完成",
}: StarDoneProps) {
  const [visible, setVisible] = useState(!appear);

  // appear 模式：初始隱藏，下一 tick 顯示（觸發動畫）
  useEffect(() => {
    if (appear) {
      const t = setTimeout(() => setVisible(true), 16);
      return () => clearTimeout(t);
    }
  }, [appear]);

  const wrapStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    flexShrink: 0,
    ...(appear
      ? {
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0)",
          transition: "opacity 200ms ease-out, transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }
      : {}),
  };

  return (
    <span
      role="img"
      aria-label={label}
      style={wrapStyle}
      className={className}
    >
      <StarShape size={size} color={color} />
    </span>
  );
}

// ─────────────────────────────────────────────
// 使用範例：
//
// import StarDone from "@/components/common/StarDone";
//
// // 標準 Done 卡片指示
// <StarDone size={11} />
//
// // 較大的 AI 回答面板標頭
// <StarDone size={14} />
//
// // 日報學習要點項目符號
// <StarDone size={10} color="#34D4A8" />
//
// // pending → done 狀態切換動畫
// {status === "done" && <StarDone appear />}
//
// // Toast 成功圖示
// <StarDone size={16} />
//
// ─────────────────────────────────────────────
// 設計規格（來自 06_前端設計書_v2.md）：
// 字元：✦（U+2726）
// 顏色：#34D4A8（DONE 磷光青綠）
// 大小：10–14px（依場景）
//
// 使用場景：
// - Done NoteCard 的狀態指示（取代純色圓點）
// - AI 回答面板標頭圖示
// - 日報學習要點的項目符號
// - Done Toast 通知圖示
