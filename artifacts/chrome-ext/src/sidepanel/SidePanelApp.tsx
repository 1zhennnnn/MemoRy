import React, { useEffect, useState } from "react";
import LoginView from "../popup/LoginView.js";
import SidePanelMainView from "./SidePanelMainView.js";
import type { Message } from "../shared/types.js";

export default function SidePanelApp() {
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
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100%", color: "#4A5272", fontSize: "13px",
      }}>
        載入中…
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {loggedIn
        ? <SidePanelMainView onLogout={() => setLoggedIn(false)} onNeedRelogin={() => setLoggedIn(false)} />
        : <LoginView onLogin={() => setLoggedIn(true)} />
      }
    </div>
  );
}
