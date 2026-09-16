import { useMemo } from "react";
import { useAnimationContext } from "../components/Shared/AnimationProvider/AnimationProvider";

const MAX_STAGGER = 0.16;

export const useOptimizedAnimation = (delay = 0, variant = "fadeUp", options = {}) => {
  const { isMobile, isTablet, shouldDisableAnimations } = useAnimationContext();
  const mount = Boolean(options.mount);

  return useMemo(() => {
    if (shouldDisableAnimations) {
      return {
        initial: false,
        animate: { opacity: 1, y: 0, x: 0, scale: 1 },
        transition: { duration: 0 },
      };
    }

    const stagger = Math.min(Math.max(Number(delay) || 0, 0), MAX_STAGGER);
    const compact = isMobile || isTablet;
    const distance = compact ? 8 : 12;
    const to = { opacity: 1, y: 0, x: 0, scale: 1 };

    let from = { opacity: 0, y: distance };
    if (variant === "fadeIn") from = { opacity: 0 };
    if (variant === "scaleIn") from = { opacity: 0, scale: 0.98 };
    if (variant === "slideIn") from = { opacity: 0, x: compact ? -6 : -10 };

    const transition = {
      duration: compact ? 0.28 : 0.35,
      delay: stagger,
      ease: [0.22, 1, 0.36, 1],
    };

    if (mount) {
      return { initial: from, animate: to, transition };
    }

    return {
      initial: from,
      whileInView: to,
      transition,
      viewport: { once: true, amount: 0.2, margin: "0px 0px -40px 0px" },
    };
  }, [delay, variant, mount, isMobile, isTablet, shouldDisableAnimations]);
};
