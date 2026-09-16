import Menu from "../Menu/menu";
import NotificationCenter from "../NotificationCenter/NotificationCenter";
import { useSystemNotifications } from "../../Hooks/Notification/useSystemNotifications"
import "./AppLayout.scss";

function AppLayout({ children, title, subtitle }) {
  // Initialiser les notifications système
  useSystemNotifications();
  return (
    <div className="app-layout">
      <img className="app-wallpaper" src="bgs.jpg" alt="" />
      <Menu />
      <main className="main-content">
        <div className="title-section">
          {title && <h1>{title}</h1>}
          {subtitle && <p className="subtitle">{subtitle}</p>}
        </div>
        <div className="content-body">{children}</div>
      </main>

      {/* NotificationCenter fixe en haut à droite */}
      <div className="notification-center-fixed">
        <NotificationCenter />
      </div>
    </div>
  );
}

export default AppLayout;
