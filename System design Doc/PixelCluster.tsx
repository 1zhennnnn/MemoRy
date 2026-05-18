// PixelCluster.tsx
// MemoRy 品牌元件 — Pixel 碎片陣列（Pending 態指示）
// 靈感：MemoRy Logo 左半的散落像素方格，代表「尚未被 AI 整理的原始知識碎片」

import React from "react";

interface PixelClusterProps {
  /** 碎片格數（3 = 3×2, 4 = 4×3），預設 3 */
  size?: 3 | 4;
  /** 是否啟用漂移動畫，預設 true */
  animated?: boolean;
  /** 整體縮放比例（1 = 標準 5px 格子），預設 1 */
  scale?: number;
  /** 自訂 className */
  className?: string;
}

// 不同 size 的像素格配置
// 每格：{ delay（動畫延遲 ms）, opacity（初始透明度）, animated（是否參與動畫） }
const GRID_3: Array<{ delay: number; opacity: number; animated: boolean }> = [
  { delay: 0,    opacity: 0.95, animated: true  },
  { delay: 400,  opacity: 0.65, animated: true  },
  { delay: 0,    opacity: 0.10, animated: false },
  { delay: 700,  opacity: 0.50, animated: true  },
  { delay: 200,  opacity: 0.90, animated: true  },
  { delay: 0,    opacity: 0.07, animated: false },
];

const GRID_4: Array<{ delay: number; opacity: number; animated: boolean }> = [
  { delay: 0,    opacity: 0.95, animated: true  },
  { delay: 300,  opacity: 0.80, animated: true  },
  { delay: 600,  opacity: 0.60, animated: true  },
  { delay: 0,    opacity: 0.10, animated: false },
  { delay: 900,  opacity: 0.70, animated: true  },
  { delay: 100,  opacity: 0.90, animated: true  },
  { delay: 500,  opacity: 0.85, animated: true  },
  { delay: 0,    opacity: 0.08, animated: false },
  { delay: 0,    opacity: 0.05, animated: false },
  { delay: 800,  opacity: 0.40, animated: true  },
  { delay: 200,  opacity: 0.75, animated: true  },
  { delay: 0,    opacity: 0.06, animated: false },
];

// 像素格顏色（對應 Logo 藍色系）
const PIXEL_COLORS = [
  "#4B6FD4", // Signal Blue（主要）
  "#3A5CC0", // 中藍
  "#2E4DB0", // Pixel Blue（深）
];

function getColor(index: number): string {
  return PIXEL_COLORS[index % PIXEL_COLORS.length];
}

export default function PixelCluster({
  size = 3,
  animated = true,
  scale = 1,
  className = "",
}: PixelClusterProps) {
  const grid = size === 3 ? GRID_3 : GRID_4;
  const cols = size === 3 ? 3 : 4;
  const pixelSize = 5 * scale;
  const gap = 1.5 * scale;

  const containerStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, ${pixelSize}px)`,
    gap: `${gap}px`,
    flexShrink: 0,
  };

  return (
    <div
      role="img"
      aria-label="AI 處理中"
      style={containerStyle}
      className={className}
    >
      {grid.map((cell, i) => {
        const shouldAnimate = animated && cell.animated;
        const pixelStyle: React.CSSProperties = {
          width: `${pixelSize}px`,
          height: `${pixelSize}px`,
          borderRadius: "1px",
          background: getColor(i),
          opacity: cell.opacity,
          ...(shouldAnimate
            ? {
                animation: `pxdrift 2.2s ease-in-out ${cell.delay}ms infinite`,
              }
            : {}),
        };
        return <div key={i} style={pixelStyle} />;
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// 使用範例：
//
// import PixelCluster from "@/components/common/PixelCluster";
//
// // 標準 pending 卡片（3×2 格，有動畫）
// <PixelCluster size={3} animated={true} />
//
// // Skeleton 佔位（無動畫，靜態）
// <PixelCluster size={4} animated={false} scale={0.8} />
//
// // 大型 Empty State 插圖
// <PixelCluster size={4} scale={3} className="opacity-30" />
//
// ─────────────────────────────────────────────
// 對應 CSS keyframe（在 globals.css 或 Tailwind 中已定義）：
//
// @keyframes pxdrift {
//   0%, 100% { opacity: 1; transform: translate(0, 0); }
//   60%       { opacity: 0.2; transform: translate(1px, -1px); }
// }
