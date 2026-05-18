import React from "react";
import type { NoteCard } from "../../shared/types.js";
import PixelCluster from "./PixelCluster.js";
import StarDone from "./StarDone.js";
import TagBadge from "./TagBadge.js";

interface NoteRowProps {
  note: NoteCard;
}

export default function NoteRow({ note }: NoteRowProps) {
  return (
    <div style={{
      padding: "10px 16px",
      borderBottom: "1px solid #1A2035",
      display: "flex",
      gap: "10px",
      alignItems: "flex-start",
    }}>
      <div style={{ paddingTop: "3px", flexShrink: 0 }}>
        {note.aiStatus === "done"    && <StarDone size={10} />}
        {note.aiStatus === "pending" && <PixelCluster size={3} scale={0.8} />}
        {note.aiStatus === "failed"  && <span style={{ color: "#F05068", fontSize: "10px" }}>✕</span>}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: "#DFE4F0",
          fontSize: "12px",
          fontWeight: 500,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          marginBottom: "2px",
        }}>
          {note.aiTitle ?? note.sourceTitle ?? "（無標題）"}
        </div>

        {note.aiSummary && (
          <div style={{
            color: "#8A96B2",
            fontSize: "11px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginBottom: "4px",
          }}>
            {note.aiSummary}
          </div>
        )}

        {note.tags.length > 0 && (
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {note.tags.slice(0, 3).map((tag) => (
              <TagBadge key={tag} name={tag} variant="ai" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
