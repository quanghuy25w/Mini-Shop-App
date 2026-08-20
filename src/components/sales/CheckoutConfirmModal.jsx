import React from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '../../utils/formatCurrency';
import './CheckoutConfirmModal.css';

const CheckoutConfirmModal = ({
  isOpen,
  totalQuantity,
  subtotal,
  discountAmount,
  totalAmount,
  isProcessing,
  onPayAndPrint,
  onPayOnly,
  onCancel
}) => {
  if (!isOpen) return null;

  const content = (
    <div className="modal-overlay">
      <div className="modal-content checkout-confirm-modal">
        <div className="confirm-modal-header">
          <div className="confirm-modal-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="2" y="6" width="20" height="12" rx="2"></rect>
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M6 12h.01M18 12h.01"></path>
            </svg>
          </div>
          <div>
            <h3>Xác nhận thanh toán</h3>
            <p className="confirm-modal-subtitle">Vui lòng chọn hình thức hoàn tất đơn hàng</p>
          </div>
        </div>

        <div className="confirm-modal-summary">
          <div className="summary-row">
            <span>Số lượng món:</span>
            <span className="font-mono font-medium">{totalQuantity} sản phẩm</span>
          </div>
          <div className="summary-row">
            <span>Tạm tính:</span>
            <span className="font-mono font-medium">{formatCurrency(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="summary-row discount-text">
              <span>Giảm giá:</span>
              <span className="font-mono font-medium">-{formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="summary-row total-row">
            <span className="total-label">Tổng thanh toán:</span>
            <span className="total-value font-mono">{formatCurrency(totalAmount)}</span>
          </div>
        </div>

        <div className="confirm-modal-actions">
          <button 
            type="button" 
            className="btn-pay-print"
            onClick={onPayAndPrint}
            disabled={isProcessing}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            <span>{isProcessing ? 'Đang xử lý...' : 'Thanh toán & In hóa đơn'}</span>
          </button>

          <button 
            type="button" 
            className="btn-pay-only"
            onClick={onPayOnly}
            disabled={isProcessing}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>{isProcessing ? 'Đang xử lý...' : 'Chỉ thanh toán (không in)'}</span>
          </button>

          <button 
            type="button" 
            className="btn-cancel-checkout"
            onClick={onCancel}
            disabled={isProcessing}
          >
            Hủy thao tác
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default CheckoutConfirmModal;
