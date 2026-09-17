import React from "react";
import { formatOpsDate, onboardingSteps } from "../../utils/platformOpsLanes";

const PlatformOnboardingTracker = ({ tenant }) => {
  if (!tenant) return null;
  const steps = onboardingSteps(tenant);
  const currentIndex = steps.findIndex((step) => !step.done);
  const activeIndex = currentIndex === -1 ? steps.length - 1 : currentIndex;

  return (
    <div className="platform-ops-tracker">
      <ol>
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={[
              step.done ? "is-done" : "",
              index === activeIndex ? "is-current" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span>{index + 1}</span>
            <em>{step.label}</em>
          </li>
        ))}
      </ol>
      <p>
        {tenant.onboardedBy === "platform" ? "Ouvert par le back-office" : "Inscription self-service"}
        {tenant.createdAt ? ` · créé ${formatOpsDate(tenant.createdAt)}` : ""}
        {tenant.activatedAt ? ` · activé ${formatOpsDate(tenant.activatedAt)}` : ""}
      </p>
    </div>
  );
};

export default PlatformOnboardingTracker;
