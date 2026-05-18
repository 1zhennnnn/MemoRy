import React from "react";
import ReactDOM from "react-dom/client";
import CaptureBar from "./CaptureBar.js";
import type { Message } from "../shared/types.js";

let captureBarRoot: HTMLDivElement | null = null;

document.addEventListener("mouseup", () => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    removeCaptureBar();
    return;
  }
  const text = selection.toString().trim();
  if (text.length < 10) return;

  const range = selection.getRangeAt(0);
  const rect  = range.getBoundingClientRect();
  showCaptureBar(text, rect);
});

function showCaptureBar(text: string, rect: DOMRect): void {
  removeCaptureBar();

  const container = document.createElement("div");
  container.id = "memory-capture-bar";
  document.body.appendChild(container);

  const top  = Math.min(window.scrollY + rect.bottom + 8, window.scrollY + window.innerHeight - 120);
  const left = Math.min(window.scrollX + rect.left,       window.scrollX + window.innerWidth  - 340);
  container.style.cssText = `position:absolute;top:${top}px;left:${left}px;z-index:2147483647;width:320px;`;

  ReactDOM.createRoot(container).render(
    <CaptureBar
      text={text}
      sourceUrl={window.location.href}
      sourceTitle={document.title}
      onClose={removeCaptureBar}
    />,
  );

  captureBarRoot = container;
}

function removeCaptureBar(): void {
  if (captureBarRoot) {
    captureBarRoot.remove();
    captureBarRoot = null;
  }
}

// 監聽 background 傳來的 Toast 通知
chrome.runtime.onMessage.addListener((message: Message) => {
  if (message.type === "SHOW_SUCCESS_TOAST") showToast("✦ 已儲存至 MemoRy");
});

function showToast(msg: string): void {
  const existing = document.getElementById("memory-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "memory-toast";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export {};
