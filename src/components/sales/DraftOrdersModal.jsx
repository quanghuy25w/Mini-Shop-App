import React from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '../../utils/formatCurrency';
import { format } from 'date-fns';
import './DraftOrdersModal.css';

const DraftOrdersModal = ({
  isOpen,
  draftOrders = [],
  onRestore,
  onDelete,
  onClearAll,
  onClose
}) => {
  if (!isOpen) return null;

  const content = (
    <div className="modal-overlay">
      <div className="modal-content draft-orders-modal">
        {/* HEADER */}
        <div className="draft-modal-header">
          <div className="draft-modal-title-wrap">
            <div className="draft-modal-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
              </svg>
            </div>
            <div>
              <h3>Danh sách đơn hàng tạm</h3>
              <p className="draft-modal-subtitle">
                Đang lưu trữ <strong>{draftOrders.length}</strong> đơn tạm
              </p>
            </div>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose} aria-label="Đóng">
            &times;
          </button>
        </div>

        {/* BODY */}
        <div className="draft-modal-body">
          {draftOrders.length === 0 ? (
            <div className="empty-drafts-view">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <line x1="9" y1="9" x2="15" y2="9"></line>
                <line x1="9" y1="13" x2="15" y2="13"></line>
              </svg>
              <p>Chưa có đơn hàng nào được lưu tạm.</p>
              <span className="empty-drafts-hint">
                Khi bán hàng, bấm "Lưu đơn hàng (F5)" để giữ đơn và phục vụ khách tiếp theo.
              </span>
            </div>
          ) : (
            <div className="draft-cards-list">
              {draftOrders.map((draft, idx) => {
                const formattedDate = draft.createdAt
                  ? format(new Date(draft.createdAt), 'HH:mm dd/MM/yyyy')
                  : 'Vừa xong';

                return (
                  <div key={draft.id || idx} className="draft-order-card">
                    <div className="draft-card-header">
                      <div className="draft-code-badge">
                        <span className="draft-code">{draft.code || `ĐƠN TẠM #${idx + 1}`}</span>
                        <span className="draft-time">{formattedDate}</span>
                      </div>
                      <div className="draft-card-amount font-mono">
                        {formatCurrency(draft.totalAmount)}
                      </div>
                    </div>

                    <div className="draft-card-items-preview">
                      {draft.items?.map((item, itemIdx) => (
                        <span key={item.productId || itemIdx} className="draft-item-tag">
                          {item.productName} <strong>x{item.quantity}</strong>
                        </span>
                      ))}
                    </div>

                    {(draft.orderNote || draft.discountAmount > 0) && (
                      <div className="draft-card-meta">
                        {draft.discountAmount > 0 && (
                          <span className="draft-discount-tag">
                            Giảm giá{draft.discountType === 'percent' && draft.discount ? ` (${draft.discount}%)` : ''}: -{formatCurrency(draft.discountAmount)}
                          </span>
                        )}
                        {draft.orderNote && (
                          <span className="draft-note-tag">
                            Ghi chú: {draft.orderNote}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="draft-card-actions">
                      <button
                        type="button"
                        className="btn-restore-draft"
                        onClick={() => onRestore(draft)}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <polyline points="1 4 1 10 7 10"></polyline>
                          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                        </svg>
                        <span>Nạp lại vào giỏ</span>
                      </button>

                      <button
                        type="button"
                        className="btn-delete-draft"
                        onClick={() => onDelete(draft.id)}
                        title="Xóa đơn tạm này"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        <span>Xóa</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="draft-modal-footer">
          {draftOrders.length > 0 && (
            <button
              type="button"
              className="btn-clear-all-drafts"
              onClick={onClearAll}
            >
              Xóa tất cả đơn tạm
            </button>
          )}
          <button type="button" className="btn-close-drafts" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default DraftOrdersModal;
