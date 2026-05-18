import React, { useEffect, useState } from "react";
import LoginView from "./LoginView.js";
import MainView from "./MainView.js";
import type { Message } from "../shared/types.js";

export default function PopupApp() {
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedIn, setLoggedIn]       = useState(false);

  useEffect(() => {
    void (async () => {
      const msg: Message = { type: "CHECK_AUTH" };
      const res = await chrome.runtime.sendMessage(msg) as { isLoggedIn?: boolean };
      setLoggedIn(res.isLoggedIn ?? false);
      setAuthChecked(true);
    })();
  }, []);

  if (!authChecked) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "120px", color: "#4A5272", fontSize: "12px" }}>
        載入中…
      </div>
    );
  }

  return loggedIn
    ? <MainView onLogout={() => setLoggedIn(false)} />
    : <LoginView onLogin={() => setLoggedIn(true)} />;
}
