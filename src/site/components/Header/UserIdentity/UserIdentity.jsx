import React, { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useUserIdentity } from "../../../hooks/useUserIdentity";
import "./UserIdentity.scss";

const UserIdentity = ({ isOpen = false, onToggle }) => {
  const { isAuthenticated, firstName, avatarUrl, initial, status } = useUserIdentity();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  if (!isAuthenticated) return null;

  const showImage = Boolean(avatarUrl) && !imageFailed;
  const label = firstName
    ? `Compte de ${firstName}, ${status.label}`
    : `Ouvrir le menu du compte, ${status.label}`;

  return (
    <button
      type="button"
      className={`user-identity${isOpen ? " is-open" : ""}`}
      onClick={onToggle}
      aria-label={label}
      aria-expanded={isOpen}
      aria-controls="site-menu-panel"
    >
      <span className="user-identity__avatar">
        {showImage ? (
          <img
            src={avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="user-identity__initial">{initial}</span>
        )}
      </span>
      {firstName ? (
        <span className="user-identity__meta">
          <span className="user-identity__name">{firstName}</span>
          <span className="user-identity__status">{status.label}</span>
        </span>
      ) : (
        <span className="user-identity__status">{status.label}</span>
      )}
      <ChevronDown className="user-identity__chevron" size={16} aria-hidden="true" />
    </button>
  );
};

export default UserIdentity;
