import './Pagination.css';

const getPageNumbers = (currentPage, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const showLeftEllipsis = currentPage > 4;
  const showRightEllipsis = currentPage < totalPages - 3;

  if (!showLeftEllipsis && showRightEllipsis) {
    return [1, 2, 3, 4, 5, '...', totalPages];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    return [
      1,
      '...',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages
    ];
  }

  if (showLeftEllipsis && showRightEllipsis) {
    return [
      1,
      '...',
      currentPage - 1,
      currentPage,
      currentPage + 1,
      '...',
      totalPages
    ];
  }

  return [];
};

const Pagination = ({
  currentPage = 1,
  totalItems = 0,
  pageSize = 20,
  onPageChange
}) => {
  const totalPages = Math.ceil(totalItems / pageSize);

  if (totalPages <= 1 || totalItems === 0) {
    return null;
  }

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <div className="pagination-container">
      <div className="pagination-info">
        Hiển thị <span className="pagination-highlight">{startItem} - {endItem}</span> của{' '}
        <span className="pagination-highlight">{totalItems}</span> sản phẩm
      </div>

      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn pagination-nav-btn"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Trang trước"
          title="Trang trước"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>

        {pageNumbers.map((page, idx) => {
          if (page === '...') {
            return (
              <span key={`dots-${idx}`} className="pagination-ellipsis">
                ...
              </span>
            );
          }

          const isActive = page === currentPage;
          return (
            <button
              key={page}
              type="button"
              className={`pagination-btn pagination-num-btn ${isActive ? 'active' : ''}`}
              onClick={() => onPageChange(page)}
              aria-current={isActive ? 'page' : undefined}
            >
              {page}
            </button>
          );
        })}

        <button
          type="button"
          className="pagination-btn pagination-nav-btn"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Trang sau"
          title="Trang sau"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Pagination;
