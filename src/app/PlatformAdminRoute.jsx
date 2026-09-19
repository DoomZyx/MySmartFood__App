import { WebsiteProviders } from "@site/WebsiteChrome.jsx";
import { PlatformAdminScreen } from "@site/components/Shared/PlatformAdminShell/PlatformAdminShell";

export default function PlatformAdminRoute() {
  return (
    <WebsiteProviders>
      <PlatformAdminScreen />
    </WebsiteProviders>
  );
}
