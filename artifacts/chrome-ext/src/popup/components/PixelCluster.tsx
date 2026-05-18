import React from "react";

interface PixelClusterProps {
  size?: 3 | 4;
  animated?: boolean;
  scale?: number;
  className?: string;
}

const GRID_3 = [
  { delay: 0,   opacity: 0.95, animated: true  },
  { delay: 400, opacity: 0.65, animated: true  },
  { delay: 0,   opacity: 0.10, animated: false },
  { delay: 700, opacity: 0.50, animated: true  },
  { delay: 200, opacity: 0.90, animated: true  },
  { delay: 0,   opacity: 0.07, animated: false },
];

const GRID_4 = [
  { delay: 0,   opacity: 0.95, animated: true  },
  { delay: 300, opacity: 0.80, animated: true  },
  { delay: 600, opacity: 0.60, animated: true  },
  { delay: 0,   opacity: 0.10, animated: false },
  { delay: 900, opacity: 0.70, animated: true  },
  { delay: 100, opacity: 0.90, animated: true  },
  { delay: 500, opacity: 0.85, animated: true  },
  { delay: 0,   opacity: 0.08, animated: false },
  { delay: 0,   opacity: 0.05, animated: false },
  { delay: 800, opacity: 0.40, animated: true  },
  { delay: 200, opacity: 0.75, animated: true  },
  { delay: 0,   opacity: 0.06, animated: false },
];

const PIXEL_COLORS = ["#4B6FD4", "#3A5CC0", "#2E4DB0"];
const getColor = (i: number) => PIXEL_COLORS[i % PIXEL_COLORS.length]!;

export default function PixelCluster({ size = 3, animated = true, scale = 1, className = "" }: PixelClusterProps) {
  const grid = size === 3 ? GRID_3 : GRID_4;
  const cols = size === 3 ? 3 : 4;
  const px   = 5 * scale;
  const gap  = 1.5 * scale;

  return (
    <div
      role="img"
      aria-label="AI 處理中"
      className={className}
      style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${px}px)`, gap: `${gap}px`, flexShrink: 0 }}
    >
      {grid.map((cell, i) => (
        <div
          key={i}
          style={{
            width: `${px}px`, height: `${px}px`, borderRadius: "1px",
            background: getColor(i), opacity: cell.opacity,
            ...(animated && cell.animated
              ? { animation: `pxdrift 2.2s ease-in-out ${cell.delay}ms infinite` }
              : {}),
          }}
        />
      ))}
      <style>{`@keyframes pxdrift{0%,100%{opacity:1;transform:translate(0,0)}60%{opacity:0.2;transform:translate(1px,-1px)}}`}</style>
    </div>
  );
}
