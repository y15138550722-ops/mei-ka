// ============================================
// ListUnifiedPagination — ORDER_BASE_V1 Pagination
// ============================================
import React from 'react';
import { useTranslation } from '../../i18n/config';

interface PaginationProps {
  total: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZE_OPTIONS = [20, 50, 100];

const ListUnifiedPagination: React.FC<PaginationProps> = ({
  total,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) => {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [jumpValue, setJumpValue] = React.useState('');

  const handleJump = () => {
    const page = parseInt(jumpValue, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
    setJumpValue('');
  };

  return (
    <div className="pagination" id="list-pagination">
      <div className="pagination__info">
        {t('common.total')} <strong>{total}</strong> {t('common.records')}
      </div>
      <div className="pagination__controls">
        <button
          className="pagination__btn"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          ‹
        </button>
        <span className="pagination__current">
          {currentPage} / {totalPages}
        </span>
        <button
          className="pagination__btn"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          ›
        </button>
        <span className="pagination__divider">|</span>
        <span className="pagination__label">{t('common.goTo')}</span>
        <input
          className="pagination__jump"
          type="text"
          value={jumpValue}
          onChange={e => setJumpValue(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => e.key === 'Enter' && handleJump()}
          placeholder=""
        />
        <span className="pagination__label">{t('common.page')}</span>
        <span className="pagination__divider">|</span>
        <select
          className="pagination__size-select"
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map(s => (
            <option key={s} value={s}>{s} {t('common.perPage')}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default ListUnifiedPagination;
