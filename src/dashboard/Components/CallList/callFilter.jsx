
export function CallFilter({ 
  filters, 
  handleFilterChange, 
  loadCalls, 
  currentPage 
}) {
 return (
  <>
   {/* Filtres */}
 <div className="filters-section">
 <div className="filter-group">
   <label>Recherche client:</label>
   <input
     type="text"
     placeholder="Nom du client..."
     value={filters.search}
     onChange={(e) => handleFilterChange("search", e.target.value)}
   />
 </div>

 <div className="filter-group">
   <label>Date:</label>
   <input
     type="date"
     value={filters.date}
     onChange={(e) => handleFilterChange("date", e.target.value)}
   />
 </div>

 <div className="filter-group">
   <label>Statut:</label>
   <select
     value={filters.status}
     onChange={(e) => handleFilterChange("status", e.target.value)}
   >
     <option value="">Tous les statuts</option>
     <option value="nouveau">Nouveau</option>
     <option value="en_cours">En cours</option>
     <option value="termine">Terminé</option>
     <option value="annule">Annulé</option>
   </select>
 </div>

 <button
   onClick={() => loadCalls(currentPage, filters)}
   className="refresh-btn"
 >
   <i className="bi bi-arrow-clockwise"></i> Actualiser
 </button>
</div>
</>
 );
}

export default CallFilter;