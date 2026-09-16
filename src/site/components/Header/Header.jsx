import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import Logo from "./Logo/Logo";
import Navigation, {
  MobileNavButton,
  MobileNavMenu,
} from "../Navigation/Navigation";
import HeaderActions from "./HeaderActions/HeaderActions";
import { useAuth } from "../../hooks/useAuth";
import "./Header.scss";

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isMenuOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.body.style.overflow = "unset";
    };
  }, [isMenuOpen]);

  const headerClassName = [
    "header",
    isScrolled ? "scrolled" : "transparent",
    isAuthenticated ? "header--authenticated" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={headerClassName}>
      <div className="header-container">
        <div className="header-content">
          <Logo />
          <Navigation />
          <div className="header-end">
            <HeaderActions />
            <MobileNavButton
              isOpen={isMenuOpen}
              onToggle={() => setIsMenuOpen((open) => !open)}
              buttonRef={buttonRef}
            />
          </div>
        </div>
      </div>
      <MobileNavMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        menuRef={menuRef}
      />
    </header>
  );
};

export default Header;
