import React, { useState, useEffect } from "react";
import Logo from "./Logo/Logo";
import { DesktopNav, SiteMenuButton, SiteMenuPanel } from "../Navigation/Navigation";
import HeaderActions from "./HeaderActions/HeaderActions";
import UserIdentity from "./UserIdentity/UserIdentity";
import { useAuth } from "../../hooks/useAuth";
import { useSiteMenu } from "../../hooks/useSiteMenu";
import { getAccountStatus } from "../../utils/accountStatus";
import "./Header.scss";

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const { isAuthenticated } = useAuth();
  const { isOpen, toggle, close, menuRef, buttonRef } = useSiteMenu();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const headerClassName = [
    "header",
    isScrolled ? "scrolled" : "transparent",
    isAuthenticated ? "header--authenticated" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={headerClassName}>
      {isOpen ? (
        <button
          type="button"
          className="site-menu-backdrop"
          aria-label="Fermer le menu"
          onClick={close}
        />
      ) : null}
      <div className="header-container">
        <div className="header-content">
          <Logo />
          <DesktopNav />
          <div className="header-end">
            {!isAuthenticated ? (
              <span className="account-status-badge">
                {getAccountStatus(null).label}
              </span>
            ) : null}
            <HeaderActions />
            <div className="header-menu" ref={menuRef}>
              <UserIdentity isOpen={isOpen} onToggle={toggle} />
              <SiteMenuButton isOpen={isOpen} onToggle={toggle} buttonRef={buttonRef} />
              <SiteMenuPanel isOpen={isOpen} onClose={close} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
