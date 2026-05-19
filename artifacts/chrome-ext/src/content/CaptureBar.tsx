import React, { useState } from "react";
import type { Message } from "../shared/types.js";

interface CaptureBarProps {
  text: string;
  sourceUrl: string;
  sourceTitle: string;
  onClose: () => void;
}

export default function CaptureBar({ text, sourceUrl, sourceTitle, onClose }: CaptureBarProps) {
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function handleSave() {
    setStatus("saving");
    try {
      const msg: Message = {
        type: "SAVE_TEXT",
        payload: { sourceText: text, sourceUrl, sourceTitle },
      };
      const res = await chrome.runtime.sendMessage(msg) as { error?: string } | undefined;
      if (res?.error) throw new Error(res.error);
      setStatus("done");
      setTimeout(onClose, 1200);
    } catch {
      setStatus("error");
    }
  }

  const base: React.CSSProperties = {
    background: "#0F1219",
    border: "1px solid #2A3555",
    borderRadius: "10px",
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
    color: "#DFE4F0",
    fontSize: "13px",
    width: "320px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  };

  const preview = text.length > 60 ? text.slice(0, 60) + "…" : text;

  return (
    <div style={base}>
      <span style={{ flex: 1, color: "#8A96B2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {preview}
      </span>

      {status === "idle" && (
        <button
          onClick={handleSave}
          style={{
            background: "#5B7AE0",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            padding: "5px 12px",
            fontSize: "12px",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          儲存
        </button>
      )}
      {status === "saving" && (
        <span style={{ color: "#5B7AE0", fontSize: "12px" }}>儲存中…</span>
      )}
      {status === "done" && (
        <span style={{ color: "#34D4A8", fontSize: "12px" }}>✦ 已儲存</span>
      )}
      {status === "error" && (
        <span style={{ color: "#F05068", fontSize: "12px" }}>失敗</span>
      )}

      <button
        onClick={onClose}
        style={{
          background: "transparent",
          border: "none",
          color: "#4A5272",
          cursor: "pointer",
          fontSize: "14px",
          padding: "2px 4px",
          lineHeight: 1,
        }}
        aria-label="關閉"
      >
        ✕
      </button>
    </div>
  );
}
