import React from "react";

interface TagBadgeProps {
  name: string;
  variant?: "user" | "ai";
}

export default function TagBadge({ name, variant = "ai" }: TagBadgeProps) {
  const color = variant === "user" ? "#7B96F0" : "#A898F0";
  return (
    <span style={{
      display: "inline-block",
      padding: "1px 6px",
      borderRadius: "4px",
      fontSize: "10px",
      color,
      background: `${color}18`,
      border: `1px solid ${color}40`,
      lineHeight: "1.4",
    }}>
      {name}
    </span>
  );
}
