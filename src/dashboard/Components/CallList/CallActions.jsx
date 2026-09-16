export function CallActions({
  calls,
  onExportCalls,
  onDeletePage,
  deletingPage,
}) {
  return (
    <div className="bulk-actions">
      <div className="selection-info">
        <span>{calls.length} appels au total</span>
      </div>
      
      {calls.length > 0 && (
        <div className="bulk-buttons">
          <button
            className="bulk-btn secondary"
            onClick={() => onExportCalls(calls)}
            title="Exporter la liste des appels en CSV"
          >
            <i className="bi bi-download"></i>
            Exporter
          </button>
          
          <button
            className="bulk-btn danger"
            onClick={() => onDeletePage(calls)}
            disabled={deletingPage}
            title="Supprimer tous les appels de cette page"
          >
            {deletingPage ? (
              <>
                <i className="bi bi-arrow-repeat spinning"></i>
                Suppression...
              </>
            ) : (
              <>
                <i className="bi bi-trash"></i>
                Supprimer la page
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
