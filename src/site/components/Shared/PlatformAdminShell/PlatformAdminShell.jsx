import { Outlet } from "react-router-dom";
import PlatformAdmin from "../../../pages/PlatformAdmin";
import "./PlatformAdminShell.scss";

export default function PlatformAdminShell({ children }) {
  return (
    <div className="platform-admin-shell">
      <header className="platform-admin-shell__bar">
        <strong>MySmartFood</strong>
        <span>Back-office</span>
      </header>
      {children ?? <Outlet />}
    </div>
  );
}

export function PlatformAdminScreen() {
  return (
    <PlatformAdminShell>
      <PlatformAdmin />
    </PlatformAdminShell>
  );
}
