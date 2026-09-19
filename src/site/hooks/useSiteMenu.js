import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

export function useSiteMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((open) => !open), []);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") close();
    };

    const handlePointerDown = (event) => {
      const target = event.target;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }
      close();
    };

    const lockScroll = window.matchMedia("(max-width: 767px)").matches;
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    if (lockScroll) document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  return { isOpen, toggle, close, menuRef, buttonRef };
}
