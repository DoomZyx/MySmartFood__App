import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "./useAuth";
import { getUserFirstName } from "../utils/userDisplay";

const EMPTY_CONTACT = {
  name: "",
  email: "",
  company: "",
  subject: "",
  message: "",
};

export function buildDemoContactPrefill(user) {
  const firstName = getUserFirstName(user);
  const greeting = firstName ? `Bonjour,\n\nJe suis ${firstName}.` : "Bonjour,";
  return {
    name: String(user?.name || "").trim(),
    email: String(user?.email || "").trim(),
    company: "",
    subject: "Rendez-vous pour une démonstration",
    message: [
      greeting,
      "J'ai renseigné les informations de mon établissement sur mySmartFood.",
      "Je souhaite prendre rendez-vous pour une démonstration.",
      "",
      "Cordialement",
    ].join("\n"),
  };
}

export function useContactFormInitialValues() {
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();

  return useMemo(() => {
    if (searchParams.get("intent") === "demo") {
      return buildDemoContactPrefill(user);
    }
    if (!isAuthenticated) return EMPTY_CONTACT;
    return {
      ...EMPTY_CONTACT,
      name: String(user?.name || "").trim(),
      email: String(user?.email || "").trim(),
    };
  }, [searchParams, user, isAuthenticated]);
}
