import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Twemoji from "react-twemoji";
import "bootstrap-icons/font/bootstrap-icons.css";
import indexCss from "../index.css?url";
import dashboardCss from "../Base/base.scss?url";
import notificationsCss from "../Styles/notifications.scss?url";
import emojiCss from "../Components/Common/EmojiText.scss?url";

export function DashboardRoot() {
  useEffect(() => {
    const nodes = [indexCss, dashboardCss, notificationsCss, emojiCss].map((href) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.theme = "dashboard";
      document.head.appendChild(link);
      return link;
    });
    return () => nodes.forEach((node) => node.remove());
  }, []);

  return (
    <Twemoji
      options={{
        className: "emoji-icon",
        folder: "svg",
        ext: ".svg",
      }}
    >
      <Outlet />
    </Twemoji>
  );
}
