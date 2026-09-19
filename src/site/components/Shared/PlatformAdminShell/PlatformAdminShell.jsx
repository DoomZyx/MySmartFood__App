import { Outlet } from "react-router-dom";
import PlatformAdmin from "../../../pages/PlatformAdmin";
import Logo from "../../Header/Logo/Logo";
import "./PlatformAdminShell.scss";

export default function PlatformAdminShell({ children }) {
  return (
    <div className="platform-admin-shell">
      <header className="platform-admin-shell__bar">
        <Logo />
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
