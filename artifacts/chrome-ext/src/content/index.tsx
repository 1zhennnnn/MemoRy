import type { Message } from "../shared/types.js";

console.log("[MemoRy] content script loaded");

let captureBar: HTMLDivElement | null = null;

// ── Selection listener ────────────────────────────────────────────────────────

document.addEventListener("mouseup", (e) => {
  if (captureBar?.contains(e.target as Node)) return;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) { removeBar(); return; }

  const text = selection.toString().trim();
  if (text.length < 10) { removeBar(); return; }

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  showBar(text, rect);
});

// click outside → close
document.addEventListener("mousedown", (e) => {
  if (captureBar && !captureBar.contains(e.target as Node)) removeBar();
});

// ── Bar lifecycle ─────────────────────────────────────────────────────────────

function showBar(text: string, rect: DOMRect): void {
  removeBar();

  const preview = text.length > 60 ? text.slice(0, 60) + "…" : text;

  const bar = document.createElement("div");
  bar.id = "memory-capture-bar";

  const top  = Math.min(rect.bottom + 8,  window.innerHeight - 80);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - 340));
  // all:unset first, then our values — inline style beats any page CSS
  bar.style.cssText = `all:unset;display:block;position:fixed;top:${top}px;left:${left}px;z-index:2147483647;width:320px;`;

  bar.innerHTML = buildHTML(preview);
  document.documentElement.appendChild(bar);
  captureBar = bar;

  bar.querySelector<HTMLButtonElement>("#memory-cb-save")!
    .addEventListener("click", () => void handleSave(text, bar));
  bar.querySelector<HTMLButtonElement>("#memory-cb-close")!
    .addEventListener("click", removeBar);
}

function removeBar(): void {
  captureBar?.remove();
  captureBar = null;
}

// ── Save ──────────────────────────────────────────────────────────────────────

async function handleSave(text: string, bar: HTMLDivElement): Promise<void> {
  const saveBtn  = bar.querySelector<HTMLElement>("#memory-cb-save")!;
  const statusEl = bar.querySelector<HTMLElement>("#memory-cb-status")!;

  saveBtn.style.display = "none";
  statusEl.textContent  = "儲存中…";
  statusEl.style.color  = "#5B7AE0";
  statusEl.style.display = "inline";

  try {
    const msg: Message = {
      type: "SAVE_TEXT",
      payload: { sourceText: text, sourceUrl: window.location.href, sourceTitle: document.title },
    };
    const res = await chrome.runtime.sendMessage(msg) as { error?: string } | undefined;
    if (res?.error) throw new Error(res.error);

    statusEl.textContent = "✦ 已儲存";
    statusEl.style.color = "#34D4A8";
    setTimeout(removeBar, 1200);
  } catch (err) {
    statusEl.textContent = err instanceof Error ? err.message : "失敗";
    statusEl.style.color = "#F05068";
    setTimeout(() => {
      statusEl.style.display = "none";
      saveBtn.style.display  = "inline";
    }, 2500);
  }
}

// ── HTML template ─────────────────────────────────────────────────────────────

function buildHTML(preview: string): string {
  const esc = preview.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  return `<div style="
    all:initial;
    display:flex;
    align-items:center;
    gap:8px;
    background:#0F1219;
    border:1px solid #2A3555;
    border-radius:10px;
    padding:10px 12px;
    box-shadow:0 4px 24px rgba(0,0,0,.65);
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    font-size:13px;
    color:#DFE4F0;
    box-sizing:border-box;
    width:320px;
  ">
    <span style="flex:1;color:#8A96B2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc}</span>
    <span id="memory-cb-status" style="display:none;font-size:12px;white-space:nowrap;"></span>
    <button id="memory-cb-save" style="
      all:initial;
      background:#5B7AE0;color:#fff;border-radius:6px;
      padding:5px 12px;font-size:12px;cursor:pointer;white-space:nowrap;
      font-family:inherit;line-height:1.4;
    ">儲存</button>
    <button id="memory-cb-close" style="
      all:initial;
      background:transparent;color:#4A5272;cursor:pointer;
      font-size:14px;padding:2px 4px;line-height:1;font-family:inherit;
    ">✕</button>
  </div>`;
}

// ── Toast from background ─────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: Message) => {
  if (message.type === "SHOW_SUCCESS_TOAST") showToast("✦ 已儲存至 MemoRy");
});

function showToast(msg: string): void {
  document.getElementById("memory-toast")?.remove();
  const t = document.createElement("div");
  t.id = "memory-toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

export {};
