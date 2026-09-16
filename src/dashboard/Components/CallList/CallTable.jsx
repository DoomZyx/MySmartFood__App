import { Pagination } from "../Common/Pagination";
import { getClientFullName, getClientPhone } from "../../utils/clientUtils";

export function CallTable({
  calls,
  loading,
  error,
  onViewCall,
  onDeleteCall,
  deleting,
  formatDate,
  getStatusBadge,
  currentPage,
  totalPages,
  onPageChange,
}) {
  // Fonction pour rendre le badge de statut
  const renderStatusBadge = (statut) => {
    const config = getStatusBadge(statut);
    return (
      <span className={`status-badge ${config.class}`}>
        {config.emoji} {config.text}
      </span>
    );
  };

  return (
    <div className="table-container">
      {loading && (
        <div className="loading-state">
          <i className="bi bi-arrow-repeat spinning"></i>
          Chargement des appels...
        </div>
      )}

      {error && (
        <div className="error-state">
          <i className="bi bi-exclamation-triangle"></i>
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {calls.length === 0 ? (
            <div className="empty-state">
              <i className="bi bi-telephone-x"></i>
              <p>Aucun appel trouvé avec ces filtres</p>
            </div>
          ) : (
            <table className="calls-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Téléphone</th>
                  <th>Type de demande</th>
                  <th>Description</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th>Suppr.</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr
                    key={call._id}
                    className="clickable-row"
                    onClick={() => onViewCall(call._id)}
                    title="Cliquer pour voir les détails"
                  >
                    <td className="client-name">
                      {call.client ? getClientFullName(call.client) : "Aucun client associé"}
                    </td>
                    <td className="phone-number">{call.client ? getClientPhone(call.client) : "-"}</td>
                    <td className="call-type">{call.type_demande}</td>
                    <td className="description">
                      {call.description
                        ? call.description.length > 50
                          ? `${call.description.substring(0, 50)}...`
                          : call.description
                        : "-"}
                    </td>
                    <td className="date">{formatDate(call.date)}</td>
                    <td className="status">{renderStatusBadge(call.statut)}</td>
                    <td className="actions-cell">
                      <div className="action-buttons">
                        <button
                          className="action-btn delete"
                          title="Supprimer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteCall(call._id);
                          }}
                          disabled={deleting === call._id}
                        >
                          {deleting === call._id ? (
                            <i className="bi bi-arrow-repeat spinning"></i>
                          ) : (
                            <i className="bi bi-trash"></i>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  );
}
