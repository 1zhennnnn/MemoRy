import React, { useState } from "react";
import type { NoteCard } from "../../shared/types.js";
import PixelCluster from "./PixelCluster.js";
import StarDone from "./StarDone.js";
import TagBadge from "./TagBadge.js";
import { useExtTheme, DASHBOARD_URL } from "../../shared/theme.js";

interface NoteRowProps {
  note: NoteCard;
}

export default function NoteRow({ note }: NoteRowProps) {
  const { colors } = useExtTheme();
  const [hovered, setHovered] = useState(false);

  async function openInDashboard() {
    const stored = await chrome.storage.local.get(["memory_auth_token", "memory_refresh_token"]);
    const accessToken  = stored["memory_auth_token"]  as string | undefined;
    const refreshToken = stored["memory_refresh_token"] as string | undefined;
    let hash = "";
    if (accessToken) {
      hash = `#ext_token=${encodeURIComponent(accessToken)}`;
      if (refreshToken) hash += `&ext_refresh=${encodeURIComponent(refreshToken)}`;
    }
    void chrome.tabs.create({ url: `${DASHBOARD_URL}/notes/${note.id}${hash}` });
  }

  return (
    <div
      onClick={() => { void openInDashboard(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="在 Dashboard 開啟"
      style={{
        padding: "10px 16px",
        borderBottom: `1px solid ${colors.border}`,
        display: "flex",
        gap: "10px",
        alignItems: "flex-start",
        cursor: "pointer",
        background: hovered ? colors.surf2 : "transparent",
        transition: "background 120ms",
      }}
    >
      <div style={{ paddingTop: "3px", flexShrink: 0 }}>
        {note.aiStatus === "done"    && <StarDone size={10} />}
        {note.aiStatus === "pending" && <PixelCluster size={3} scale={0.8} />}
        {note.aiStatus === "failed"  && <span style={{ color: colors.failed, fontSize: "10px" }}>✕</span>}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: colors.textHi,
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
            color: colors.textMid,
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

      {/* Open indicator */}
      <div style={{
        flexShrink: 0, fontSize: "10px",
        color: hovered ? colors.signal : "transparent",
        transition: "color 120ms",
        alignSelf: "center",
      }}>
        ↗
      </div>
    </div>
  );
}
