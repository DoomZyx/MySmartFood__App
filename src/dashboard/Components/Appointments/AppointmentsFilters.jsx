import { useTranslation } from "react-i18next";

export function AppointmentsFilters({
  filters,
  handleFilterChange,
  resetFilters,
  hasActiveFilters,
  activeService,
  setActiveService,
}) {
  const { t } = useTranslation();
  
  return (
    <div className="filters-section">
      <div className="filters-group">
        <div className="filter-item">
          <input
            type="date"
            value={filters.date}
            onChange={(e) => handleFilterChange("date", e.target.value)}
          />
        </div>
        
        {/* Boutons Service Midi/Soir */}
        {activeService !== undefined && setActiveService && (
          <div className="service-buttons">
            <button
              className={`service-btn ${activeService === "midi" ? "active" : ""}`}
              onClick={() => setActiveService("midi")}
            >
            {t('appointments.services.lunch')}
            </button>
            <button
              className={`service-btn ${activeService === "soir" ? "active" : ""}`}
              onClick={() => setActiveService("soir")}
            >
              {t('appointments.services.dinner')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
