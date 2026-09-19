import { useLayoutEffect } from "react";
import { Outlet } from "react-router-dom";
import Twemoji from "react-twemoji";
import "bootstrap-icons/font/bootstrap-icons.css";
import { WebSocketProvider } from "../dashboard/Context/WebSocketContext";
import NotificationCenter from "../dashboard/Components/NotificationCenter/NotificationCenter";
import "../dashboard/index.css";
import "../dashboard/Base/base.scss";
import "../dashboard/Styles/notifications.scss";
import "../dashboard/Components/Common/EmojiText.scss";
import "../dashboard/Components/Layout/AppLayout.scss";

export function DashboardRoot() {
  useLayoutEffect(() => {
    document.querySelectorAll('link[data-theme="website"]').forEach((node) => node.remove());
    document.documentElement.dataset.app = "dashboard";
  }, []);

  return (
    <WebSocketProvider>
      <Twemoji
        options={{
          className: "emoji-icon",
          folder: "svg",
          ext: ".svg",
        }}
      >
        <Outlet />
        <div className="notification-center-fixed">
          <NotificationCenter />
        </div>
      </Twemoji>
    </WebSocketProvider>
  );
}
