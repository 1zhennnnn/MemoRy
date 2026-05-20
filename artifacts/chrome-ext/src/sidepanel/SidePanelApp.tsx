import React, { useEffect, useState } from "react";
import LoginView from "../popup/LoginView.js";
import SidePanelMainView from "./SidePanelMainView.js";
import type { Message } from "../shared/types.js";
import { ThemeContext, DARK, LIGHT, type Theme } from "../shared/theme.js";

const THEME_KEY = "memory_theme";

export default function SidePanelApp() {
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedIn, setLoggedIn]       = useState(false);
  const [theme, setTheme]             = useState<Theme>("dark");

  useEffect(() => {
    void (async () => {
      // Load saved theme
      const stored = await chrome.storage.local.get(THEME_KEY);
      if (stored[THEME_KEY] === "light") setTheme("light");

      // Check auth
      const msg: Message = { type: "CHECK_AUTH" };
      const res = await chrome.runtime.sendMessage(msg) as { isLoggedIn?: boolean };
      setLoggedIn(res.isLoggedIn ?? false);
      setAuthChecked(true);
    })();
  }, []);

  function toggle() {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      void chrome.storage.local.set({ [THEME_KEY]: next });
      return next;
    });
  }

  const colors = theme === "dark" ? DARK : LIGHT;

  if (!authChecked) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100%", background: colors.bg, color: colors.textLo, fontSize: "13px",
      }}>
        載入中…
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ colors, theme, toggle }}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", background: colors.bg }}>
        {loggedIn
          ? <SidePanelMainView onLogout={() => setLoggedIn(false)} onNeedRelogin={() => setLoggedIn(false)} />
          : <LoginView onLogin={() => setLoggedIn(true)} />
        }
      </div>
    </ThemeContext.Provider>
  );
}
