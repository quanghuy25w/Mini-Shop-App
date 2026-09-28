import { useState, useEffect } from 'react';
import { workSessionApi } from '../../api/workSessionApi';
import { formatCurrency } from '../../utils/formatCurrency';
import { toast } from 'react-toastify';
import '../../pages/WorkSession/WorkSession.css';

const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const WorkSessionFormModal = ({ isOpen, onClose, editingSession = null, onSuccess }) => {
  const [initialCash, setInitialCash] = useState('0');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !editingSession) return;
    setTimeout(() => setInitialCash(String(editingSession.initialCash ?? 0)), 0);
    setTimeout(() => setNote(editingSession.note || ''), 0);
  }, [isOpen, editingSession]);

  if (!isOpen || !editingSession) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsedInitialCash = Number(initialCash);
    if (isNaN(parsedInitialCash) || parsedInitialCash < 0) {
      toast.error('Tiền đầu ca phải là số hợp lệ');
      return;
    }

    setIsSubmitting(true);
    try {
      await workSessionApi.patch(editingSession.id, {
        initialCash: parsedInitialCash,
        note: note.trim()
      });
      toast.success(`Cập nhật ca làm việc ${editingSession.code} thành công`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Lỗi khi cập nhật ca làm việc:', err);
      toast.error('Không thể cập nhật ca làm việc. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ws-modal-backdrop">
      <div className="ws-modal-card" style={{ maxWidth: '480px' }}>
        <div className="ws-modal-header">
          <h3>Chỉnh sửa ca làm việc</h3>
          <button type="button" className="btn-icon-only" onClick={onClose} aria-label="Đóng modal">
            <IconX />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ws-modal-body">
            
            <div style={{ background: 'var(--surface-sunk)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              <div className="data-stack">
                <span className="data-subtitle">Mã ca</span>
                <span className="font-mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>{editingSession.code}</span>
              </div>
              <div className="data-stack">
                <span className="data-subtitle">Tên ca</span>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{editingSession.name}</span>
              </div>
              <div className="data-stack">
                <span className="data-subtitle">Ngày làm việc</span>
                <span className="font-mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>{editingSession.date}</span>
              </div>
              <div className="data-stack">
                <span className="data-subtitle">Trạng thái</span>
                <span style={{ fontWeight: 600, color: 'var(--ink)', textTransform: 'capitalize' }}>{editingSession.status}</span>
              </div>
            </div>

            <div className="ws-form-group">
              <label className="ws-form-label">
                Tiền mặt đầu ca (VNĐ) <span className="text-brick">*</span>
              </label>
              <input
                type="number"
                className="ws-form-input font-mono"
                style={{ fontSize: '15px' }}
                value={initialCash}
                onChange={(e) => setInitialCash(e.target.value)}
                min="0"
                step="1000"
                required
                disabled={editingSession.status !== 'planned'}
              />
              {editingSession.status !== 'planned' && (
                <span style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px', display: 'block' }}>
                  (Tiền mặt đầu ca chỉ được chỉnh sửa khi ca ở trạng thái kế hoạch)
                </span>
              )}
              <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
                {formatCurrency(Number(initialCash) || 0)}
              </span>
            </div>

            <div className="ws-form-group">
              <label className="ws-form-label">
                Ghi chú ca làm việc
              </label>
              <textarea
                className="ws-form-textarea"
                style={{ minHeight: '80px', resize: 'vertical' }}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nhập ghi chú hoặc vấn đề phát sinh trong ca..."
              />
            </div>
          </div>

          <div className="ws-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Hủy
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkSessionFormModal;
