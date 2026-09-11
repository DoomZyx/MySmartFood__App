import SiteHeader from "../../Components/SiteHeader/SiteHeader";
import { useSiteNav } from "../../Hooks/Site/useSiteNav";
import "./SiteLayout.scss";

function SiteLayout({ children }) {
  const nav = useSiteNav();

  return (
    <div className="site-shell">
      <SiteHeader
        isLoggedIn={nav.isLoggedIn}
        hasDashboard={nav.hasDashboard}
        displayName={nav.displayName}
      />
      <main className="site-shell__main">{children}</main>
    </div>
  );
}

export default SiteLayout;
