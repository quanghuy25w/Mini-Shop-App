import { useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '../../utils/formatCurrency';
import './CheckoutConfirmModal.css';

const QUICK_AMOUNTS = [50000, 100000, 200000, 500000];

const CheckoutConfirmModal = ({
  isOpen,
  totalQuantity,
  subtotal,
  discountAmount,
  discountType = 'amount',
  discountValue = '0',
  totalAmount,
  initialNote = '',
  isProcessing,
  onPayAndPrint,
  onPayOnly,
  onCancel
}) => {
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'transfer' | 'card'
  const [cashReceived, setCashReceived] = useState(String(totalAmount || 0));
  const [note, setNote] = useState(initialNote || '');

  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setPaymentMethod('cash');
      setCashReceived(String(totalAmount || 0));
      setNote(initialNote || '');
    }
  }

  if (!isOpen) return null;

  const cashNum = cashReceived === '' ? 0 : Number(cashReceived);
  const change = paymentMethod === 'cash' ? Math.max(0, cashNum - totalAmount) : 0;
  const isCashInsufficient = paymentMethod === 'cash' && cashNum < totalAmount;

  const handlePayAndPrintClick = () => {
    if (isCashInsufficient) return;
    const payload = {
      paymentMethod,
      cashReceived: paymentMethod === 'cash' ? (cashReceived === '' ? totalAmount : Number(cashReceived)) : null,
      change,
      note: note.trim()
    };
    if (onPayAndPrint) {
      onPayAndPrint(payload);
    }
  };

  const handlePayOnlyClick = () => {
    if (isCashInsufficient) return;
    const payload = {
      paymentMethod,
      cashReceived: paymentMethod === 'cash' ? (cashReceived === '' ? totalAmount : Number(cashReceived)) : null,
      change,
      note: note.trim()
    };
    if (onPayOnly) {
      onPayOnly(payload);
    }
  };

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

        {/* PAYMENT METHOD TABS */}
        <div className="payment-method-tabs">
          <button
            type="button"
            className={`pm-tab ${paymentMethod === 'cash' ? 'active' : ''}`}
            onClick={() => setPaymentMethod('cash')}
          >
            💵 Tiền mặt
          </button>
          <button
            type="button"
            className={`pm-tab ${paymentMethod === 'transfer' ? 'active' : ''}`}
            onClick={() => setPaymentMethod('transfer')}
          >
            📱 Chuyển khoản
          </button>
          <button
            type="button"
            className={`pm-tab ${paymentMethod === 'card' ? 'active' : ''}`}
            onClick={() => setPaymentMethod('card')}
          >
            💳 Thẻ
          </button>
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
              <span>Giảm giá{discountType === 'percent' && discountValue ? ` (${discountValue}%)` : ''}:</span>
              <span className="font-mono font-medium">-{formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="summary-row total-row">
            <span className="total-label">Tổng thanh toán:</span>
            <span className="total-value font-mono">{formatCurrency(totalAmount)}</span>
          </div>

          {/* CASH INPUT & CHANGE CALCULATION */}
          {paymentMethod === 'cash' && (
            <div className="cash-payment-details">
              <div className="cash-input-group">
                <label htmlFor="pos-cash-received">Tiền khách đưa:</label>
                <div className="cash-input-wrap">
                  <input
                    id="pos-cash-received"
                    type="number"
                    min="0"
                    step="1000"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="Nhập số tiền..."
                    className="font-mono"
                    autoFocus
                  />
                  <span className="currency-unit">₫</span>
                </div>
              </div>

              {/* QUICK AMOUNT SUGGESTIONS */}
              <div className="quick-amount-buttons">
                <button
                  type="button"
                  className="btn-quick-amount exact"
                  onClick={() => setCashReceived(String(totalAmount))}
                >
                  Đủ tiền
                </button>
                {QUICK_AMOUNTS.filter(amt => amt >= totalAmount || totalAmount < 500000).map(amt => (
                  <button
                    key={amt}
                    type="button"
                    className={`btn-quick-amount ${cashNum === amt ? 'selected' : ''}`}
                    onClick={() => setCashReceived(String(amt))}
                  >
                    {formatCurrency(amt)}
                  </button>
                ))}
              </div>

              <div className="summary-row change-row">
                <span className="change-label">Tiền thối lại:</span>
                <span className={`change-value font-mono ${isCashInsufficient ? 'text-danger' : 'text-success'}`}>
                  {formatCurrency(change)}
                </span>
              </div>

              {isCashInsufficient && (
                <div className="cash-alert-warning">
                  ⚠️ Số tiền khách đưa còn thiếu {formatCurrency(totalAmount - cashNum)}!
                </div>
              )}
            </div>
          )}

          {/* ORDER NOTE INPUT */}
          <div className="order-note-group">
            <label htmlFor="pos-order-note">Ghi chú đơn hàng:</label>
            <input
              id="pos-order-note"
              type="text"
              placeholder="VD: Giao hàng tận nơi, khách VIP..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className="confirm-modal-actions">
          <button 
            type="button" 
            className="btn-pay-print"
            onClick={handlePayAndPrintClick}
            disabled={isProcessing || isCashInsufficient}
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
            onClick={handlePayOnlyClick}
            disabled={isProcessing || isCashInsufficient}
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
