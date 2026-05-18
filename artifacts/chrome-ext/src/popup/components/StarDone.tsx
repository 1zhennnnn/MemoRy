import React, { useEffect, useState } from "react";

interface StarDoneProps {
  size?: number;
  color?: string;
  appear?: boolean;
  className?: string;
  label?: string;
}

function StarShape({ size, color }: { size: number; color: string }) {
  const cx = 10, cy = 10, outer = 8, inner = 2.5;
  const pts = [
    `${cx},${cy - outer}`,   `${cx + inner},${cy - inner}`,
    `${cx + outer},${cy}`,   `${cx + inner},${cy + inner}`,
    `${cx},${cy + outer}`,   `${cx - inner},${cy + inner}`,
    `${cx - outer},${cy}`,   `${cx - inner},${cy - inner}`,
  ].join(" ");
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill={color} aria-hidden style={{ display: "inline-block", flexShrink: 0 }}>
      <polygon points={pts} />
    </svg>
  );
}

export default function StarDone({ size = 11, color = "#34D4A8", appear = false, className = "", label = "AI 完成" }: StarDoneProps) {
  const [visible, setVisible] = useState(!appear);
  useEffect(() => {
    if (appear) {
      const t = setTimeout(() => setVisible(true), 16);
      return () => clearTimeout(t);
    }
  }, [appear]);

  return (
    <span
      role="img" aria-label={label} className={className}
      style={{
        display: "inline-flex", alignItems: "center", flexShrink: 0,
        ...(appear ? {
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0)",
          transition: "opacity 200ms ease-out, transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        } : {}),
      }}
    >
      <StarShape size={size} color={color} />
    </span>
  );
}
