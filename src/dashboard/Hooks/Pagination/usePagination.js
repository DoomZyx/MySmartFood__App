import { useState } from "react";

export function usePagination(initialPage = 1) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      return page;
    }
    return currentPage;
  };

  const nextPage = () => {
    return goToPage(currentPage + 1);
  };

  const prevPage = () => {
    return goToPage(currentPage - 1);
  };

  const goToFirstPage = () => {
    return goToPage(1);
  };

  const goToLastPage = () => {
    return goToPage(totalPages);
  };

  const updatePagination = (total, itemsPerPage = 20) => {
    const pages = Math.ceil(total / itemsPerPage);
    setTotalPages(pages);
    setTotalItems(total);
    
    // Si la page courante dépasse le nombre total de pages, revenir à la dernière page
    if (currentPage > pages && pages > 0) {
      setCurrentPage(pages);
      return pages;
    }
    
    return currentPage;
  };

  const resetPagination = () => {
    setCurrentPage(1);
    setTotalPages(1);
    setTotalItems(0);
  };

  const getPaginationInfo = () => {
    const itemsPerPage = 20;
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);
    
    return {
      startItem,
      endItem,
      totalItems,
      currentPage,
      totalPages,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
    };
  };

  return {
    // États
    currentPage,
    totalPages,
    totalItems,
    
    // Actions
    goToPage,
    nextPage,
    prevPage,
    goToFirstPage,
    goToLastPage,
    updatePagination,
    resetPagination,
    
    // Utilitaires
    getPaginationInfo,
  };
}
