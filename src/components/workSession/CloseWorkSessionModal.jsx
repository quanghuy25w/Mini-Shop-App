import { useState, useMemo } from 'react';
import { workSessionApi } from '../../api/workSessionApi';
import { formatCurrency } from '../../utils/formatCurrency';
import { calculateSessionReconciliation } from '../../utils/reconciliation';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth';
import '../../pages/WorkSession/WorkSession.css';

const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const IconAlert = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

const CloseWorkSessionModal = ({ isOpen, onClose, session, orders = [], onSuccess }) => {
  const { currentUser } = useAuth();
  const [actualCash, setActualCash] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tính toán doanh số và tiền mặt trong ca bằng cỗ máy đối soát chuẩn duy nhất
  const recon = useMemo(() => {
    if (!session) return null;
    return calculateSessionReconciliation({
      session,
      orders,
      actualCash: actualCash === '' || isNaN(Number(actualCash)) ? null : Number(actualCash),
      options: { recalculateLive: true }
    });
  }, [session, orders, actualCash]);

  const initialCash = recon ? recon.initialCash : 0;
  const cashSales = recon ? recon.cashSales : 0;
  const cashCancels = recon ? recon.cashRefunds : 0;
  const expectedCash = recon ? recon.expectedCash : 0;
  const totalOrdersCount = recon ? recon.completedOrderCount : 0;
  const totalRevenue = recon ? recon.totalRevenue : 0;
  const discrepancy = recon ? recon.cashDifference : null;

  if (!isOpen || !session) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (actualCash === '' || isNaN(Number(actualCash)) || Number(actualCash) < 0) {
      toast.error('Vui lòng nhập số tiền mặt thực tế kiểm đếm (>= 0)');
      return;
    }

    const numActual = Number(actualCash);
    const diff = numActual - expectedCash;

    if (Math.abs(diff) > 0 && !closeNote.trim()) {
      toast.error('Có chênh lệch tiền mặt. Vui lòng nhập lý do giải trình.');
      return;
    }

    setIsSubmitting(true);
    try {
      await workSessionApi.closeSession(session.id, {
        actualCash: numActual,
        closeNote: closeNote.trim(),
        actor: currentUser,
      });

      toast.success(`Đã đóng ca làm việc ${session.code} và hoàn tất kết toán`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Lỗi khi đóng ca làm việc:', err);
      toast.error(err.message || 'Không thể đóng ca. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ws-modal-backdrop">
      <div className="ws-modal-card" style={{ maxWidth: '540px' }}>
        <div className="ws-modal-header">
          <div className="data-stack">
            <h3>Kết toán & Đóng ca làm việc</h3>
            <span className="data-subtitle">
              Mã ca: <strong>{session.code}</strong> — {session.name} ({session.date})
            </span>
          </div>
          <button type="button" className="btn-icon-only" onClick={onClose} aria-label="Đóng modal">
            <IconX />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ws-modal-body">
            {/* Tóm tắt kinh doanh */}
            <div className="recon-section">
              <span className="recon-section-title">1. Tổng quan bán hàng</span>
              <div className="recon-box">
                <div className="recon-row">
                  <span>Tổng số đơn hoàn tất:</span>
                  <span className="font-mono font-medium">{totalOrdersCount} đơn</span>
                </div>
                <div className="recon-row">
                  <span>Tổng doanh thu (tất cả HTTT):</span>
                  <span className="font-mono font-medium text-ledger">{formatCurrency(totalRevenue)}</span>
                </div>
              </div>
            </div>

            {/* Bảng tổng hợp đối soát tiền mặt */}
            <div className="recon-section">
              <span className="recon-section-title">2. Đối soát tiền mặt</span>
              <div className="recon-box">
                <div className="recon-row">
                  <span>Tiền đầu ca:</span>
                  <span className="font-mono">{formatCurrency(initialCash)}</span>
                </div>
                <div className="recon-row">
                  <span>+ Doanh thu tiền mặt:</span>
                  <span className="font-mono text-ledger">+{formatCurrency(cashSales)}</span>
                </div>
                {cashCancels > 0 && (
                  <div className="recon-row">
                    <span>- Hủy đơn tiền mặt:</span>
                    <span className="font-mono text-brick">-{formatCurrency(cashCancels)}</span>
                  </div>
                )}
                <div className="recon-row highlight">
                  <span>Tiền mặt kỳ vọng trong két:</span>
                  <span className="font-mono text-ledger" style={{ fontSize: '18px' }}>
                    {formatCurrency(expectedCash)}
                  </span>
                </div>
              </div>
            </div>

            {/* Nhập tiền thực tế */}
            <div className="ws-form-group">
              <label className="ws-form-label">
                Tiền mặt thực tế kiểm đếm (VNĐ) <span className="text-brick">*</span>
              </label>
              <input
                type="number"
                className="ws-form-input font-mono"
                style={{ fontSize: '18px', fontWeight: 700 }}
                placeholder="Nhập số tiền thực tế..."
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                min="0"
                step="1000"
                required
                autoFocus
              />
            </div>

            {/* Thông báo chênh lệch */}
            {discrepancy !== null && (
              <div className={`recon-alert ${discrepancy === 0 ? 'match' : discrepancy > 0 ? 'surplus' : 'shortage'}`}>
                {discrepancy === 0 ? (
                  <>
                    <IconCheck /> Khớp 100% với hệ thống ({formatCurrency(expectedCash)})
                  </>
                ) : discrepancy > 0 ? (
                  <>
                    <IconAlert /> Thừa tiền: +{formatCurrency(discrepancy)}
                  </>
                ) : (
                  <>
                    <IconAlert /> Thiếu tiền: -{formatCurrency(Math.abs(discrepancy))}
                  </>
                )}
              </div>
            )}

            {/* Lý do giải trình */}
            <div className="ws-form-group">
              <label className="ws-form-label">
                Ghi chú đóng ca {discrepancy !== null && Math.abs(discrepancy) > 0 && <span className="text-brick">(Bắt buộc giải trình chênh lệch) *</span>}
              </label>
              <textarea
                className="ws-form-textarea"
                style={{ minHeight: '60px' }}
                value={closeNote}
                onChange={(e) => setCloseNote(e.target.value)}
                placeholder={discrepancy !== null && Math.abs(discrepancy) > 0 ? 'Nhập lý do giải trình chênh lệch...' : 'Ghi chú bàn giao ca (nếu có)...'}
                required={discrepancy !== null && Math.abs(discrepancy) > 0}
              />
            </div>
          </div>

          <div className="ws-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Hủy
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ backgroundColor: 'var(--brick)' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Đang xử lý...' : 'Xác nhận đóng ca'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CloseWorkSessionModal;
