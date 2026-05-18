// TimelineConnector.tsx
// MemoRy 品牌元件 — 時間軸電路連接線
// 靈感：MemoRy Logo 右半的電路節點線，代表「已連結的知識」
// 用於 Web Dashboard 時間軸頁面，連接同日的筆記卡片

import React from "react";

// ─── 型別定義 ────────────────────────────────
type NoteStatus = "done" | "pending" | "failed";

interface TimelineNode {
  id: string;
  status: NoteStatus;
}

interface TimelineConnectorProps {
  /** 節點列表（對應每張 NoteCard） */
  nodes: TimelineNode[];
  /** 子元素（NoteCard 陣列，與 nodes 一一對應） */
  children: React.ReactNode[];
  /** 自訂 className */
  className?: string;
}

// ─── 顏色映射 ────────────────────────────────
const NODE_COLORS: Record<NoteStatus, string> = {
  done:    "#34D4A8",   // Done 磷光綠
  pending: "#F0A030",   // Pending 琥珀
  failed:  "#F05068",   // Failed 鮮紅
};

// ─── 節點元件 ────────────────────────────────
function ConnectorNode({ status }: { status: NoteStatus }) {
  const color = NODE_COLORS[status];
  return (
    <div
      role="img"
      aria-label={`筆記狀態：${status}`}
      style={{
        position: "absolute",
        left: "1px",
        top: "20px",   // 對齊 NoteCard 標題行
        width: "9px",
        height: "9px",
        borderRadius: "50%",
        background: "#161A28",   // SURFACE-2（與卡片同色）
        border: `1.5px solid ${color}`,
        zIndex: 1,
        transition: "border-color 300ms ease",
      }}
    />
  );
}

// ─── 主元件 ──────────────────────────────────
export default function TimelineConnector({
  nodes,
  children,
  className = "",
}: TimelineConnectorProps) {
  const childArray = React.Children.toArray(children);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        paddingLeft: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* 垂直連接線 */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "5px",
          top: "6px",
          bottom: "6px",
          width: "1px",
          background: "rgba(88,100,160,0.13)",  // LINE-FAINT
        }}
      />

      {/* 節點 + 卡片 */}
      {nodes.map((node, i) => (
        <div key={node.id} style={{ position: "relative" }}>
          <ConnectorNode status={node.status} />
          {childArray[i] ?? null}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// 使用範例（TimelinePage.tsx）：
//
// import TimelineConnector from "@/components/common/TimelineConnector";
// import NoteCard from "@/components/notes/NoteCard";
//
// // 在日期群組中包裹卡片
// <TimelineConnector
//   nodes={todayNotes.map(n => ({ id: n.id, status: n.aiStatus as NoteStatus }))}
// >
//   {todayNotes.map(note => (
//     <NoteCard key={note.id} note={note} />
//   ))}
// </TimelineConnector>
//
// ─────────────────────────────────────────────
// 設計規格（來自 06_前端設計書_v2.md §7.3）：
//
// 連接線：
//   左側 1px 垂直線，rgba(88,100,160,0.13)
//   top: 6px → bottom: 6px（留邊距）
//
// 節點（9px 圓形）：
//   Done    → border-color: #34D4A8（磷光綠）
//   Pending → border-color: #F0A030（琥珀）
//   Failed  → border-color: #F05068（鮮紅）
//   背景：SURFACE-2（與卡片同色，製造「中空」感）
//
// 對齊：left: 1px, top: 20px（對齊卡片標題行高度）
// 卡片間距：gap: 10px
