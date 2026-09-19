import { useState } from "react";
import Menu from "../Menu/menu";
import { useSystemNotifications } from "../../Hooks/Notification/useSystemNotifications"
import { getCurrentUser, stopImpersonationSession } from "../../API/auth";
import "./AppLayout.scss";

function ImpersonationBanner() {
  const user = getCurrentUser();
  const [busy, setBusy] = useState(false);
  if (!user?.impersonation) return null;
  return (
    <p className="subtitle" role="status">
      Session support sur {user.email}. Les actions sont celles du client.{" "}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await stopImpersonationSession();
          } finally {
            window.location.assign("/bf-admin");
          }
        }}
      >
        Revenir au back-office
      </button>
    </p>
  );
}

function AppLayout({ children, title, subtitle }) {
  useSystemNotifications();
  return (
    <div className="app-layout">
      <Menu />
      <main className="main-content">
        <div className="title-section">
          {title && <h1>{title}</h1>}
          {subtitle && <p className="subtitle">{subtitle}</p>}
          <ImpersonationBanner />
        </div>
        <div className="content-body">{children}</div>
      </main>
    </div>
  );
}

export default AppLayout;
