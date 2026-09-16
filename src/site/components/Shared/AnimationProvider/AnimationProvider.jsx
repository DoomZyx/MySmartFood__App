import React, { createContext, useContext, useEffect, useState } from "react";

const AnimationContext = createContext();

function readViewport() {
  if (typeof window === "undefined") {
    return { isMobile: false, isTablet: false };
  }
  const width = window.innerWidth;
  return {
    isMobile: width <= 768,
    isTablet: width > 768 && width <= 1024,
  };
}

function readReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const useAnimationContext = () => {
  const context = useContext(AnimationContext);
  if (!context) {
    throw new Error("useAnimationContext must be used within an AnimationProvider");
  }
  return context;
};

export const AnimationProvider = ({ children }) => {
  const [{ isMobile, isTablet }, setViewport] = useState(readViewport);
  const [isLowPowerMode, setIsLowPowerMode] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(readReducedMotion);

  useEffect(() => {
    const onResize = () => setViewport(readViewport());
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setPrefersReducedMotion(media.matches);

    window.addEventListener("resize", onResize);
    media.addEventListener("change", onMotion);

    let batteryTimer = null;
    if ("getBattery" in navigator) {
      navigator.getBattery().then((battery) => {
        const update = () => setIsLowPowerMode(battery.level < 0.2);
        update();
        batteryTimer = setInterval(update, 30000);
      });
    }

    return () => {
      window.removeEventListener("resize", onResize);
      media.removeEventListener("change", onMotion);
      if (batteryTimer) clearInterval(batteryTimer);
    };
  }, []);

  const shouldDisableAnimations = isLowPowerMode || prefersReducedMotion;

  const value = {
    isMobile,
    isTablet,
    isLowPowerMode,
    prefersReducedMotion,
    shouldDisableAnimations,
    animationConfig: {
      duration: shouldDisableAnimations ? 0 : 0.35,
      delay: 0,
      ease: [0.22, 1, 0.36, 1],
    },
  };

  return (
    <AnimationContext.Provider value={value}>{children}</AnimationContext.Provider>
  );
};
