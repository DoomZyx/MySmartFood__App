export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="page-btn"
      >
        <i className="bi bi-chevron-left"></i>
      </button>

      <span className="page-info">
        Page {currentPage} sur {totalPages}
      </span>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="page-btn"
      >
        <i className="bi bi-chevron-right"></i>
      </button>
    </div>
  );
}
