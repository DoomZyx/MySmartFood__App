import { usePhoneToggle } from "../../Hooks/PhoneToggle/usePhoneToggle";
import "./PhoneToggle.scss";

export default function PhoneToggle() {
  const { isOn, isBusy, error, toggle } = usePhoneToggle();

  return (
    <div className="phone-toggle">
      <button
        type="button"
        className={`ios-switch ${isOn ? "on" : "off"} ${isBusy ? "busy" : ""}`}
        aria-pressed={isOn}
        aria-label={isOn ? "Couper la ligne" : "Activer la ligne"}
        onClick={toggle}
        disabled={isBusy}
      >
        <span className="track">
          <span className="thumb" />
        </span>
        <span className="label-text">{isOn ? "ON" : "OFF"}</span>
      </button>
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}



