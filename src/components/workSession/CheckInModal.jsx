import { useWorkSession } from '../../hooks/useWorkSession';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import '../../pages/WorkSession/WorkSession.css';

const IconAlertCircle = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const SHIFT_TYPE_LABELS = {
  morning: { label: 'Ca sáng', class: 'shift-morning' },
  afternoon: { label: 'Ca chiều', class: 'shift-afternoon' },
  evening: { label: 'Ca tối', class: 'shift-evening' }
};

const CheckInModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const {
    currentSession,
    currentMember,
    isCheckedIn,
    workingStatus,
    updateWorkingStatus
  } = useWorkSession();

  if (!isOpen) return null;

  const handleToggleStatus = async (status) => {
    try {
      await updateWorkingStatus(status);
      toast.info(`Đã đổi trạng thái sang: ${status === 'busy' ? 'Đang bán hàng' : 'Hoạt động'}`);
    } catch {
      toast.error('Không thể cập nhật trạng thái');
    }
  };

  return (
    <div className="ws-modal-backdrop">
      <div className="ws-modal-card" style={{ maxWidth: '440px' }}>
        <div className="ws-modal-header">
          <h3>Thông tin ca trực</h3>
          <button type="button" className="btn-icon-only" onClick={onClose} aria-label="Đóng modal">
            <IconX />
          </button>
        </div>

        <div className="ws-modal-body">
          {isCheckedIn && currentSession ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="font-mono" style={{ fontWeight: 600, fontSize: '15px' }}>
                      {currentSession.code}
                    </span>
                    <span className={`shift-type-pill ${SHIFT_TYPE_LABELS[currentSession.shiftType]?.class || 'shift-morning'}`}>
                      {SHIFT_TYPE_LABELS[currentSession.shiftType]?.label || currentSession.shiftType}
                    </span>
                  </div>
                  <span className="session-status-badge session-status-active">
                    <span className="status-dot"></span> Đang trực ca
                  </span>
                </div>

                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>
                  {currentSession.name}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--ink-soft)', marginTop: '8px' }}>
                  <div className="data-row">
                    <span>Ngày làm việc:</span>
                    <strong style={{ color: 'var(--ink)' }}>{currentSession.date}</strong>
                  </div>
                  {currentMember?.checkInTime && (
                    <div className="data-row">
                      <span>Giờ vào ca:</span>
                      <strong className="font-mono" style={{ color: 'var(--ink)' }}>{format(new Date(currentMember.checkInTime), 'HH:mm dd/MM')}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Status segmented control */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                  Trạng thái làm việc hiện tại:
                </label>
                <div style={{ display: 'flex', gap: '8px', background: 'var(--surface-sunk)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: workingStatus !== 'busy' ? 'var(--surface)' : 'transparent',
                      color: workingStatus !== 'busy' ? 'var(--ledger-dark)' : 'var(--ink-soft)',
                      fontWeight: 600,
                      border: 'none',
                      boxShadow: workingStatus !== 'busy' ? 'var(--shadow-sm)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => handleToggleStatus('active')}
                  >
                    Hoạt động
                  </button>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: workingStatus === 'busy' ? 'var(--surface)' : 'transparent',
                      color: workingStatus === 'busy' ? '#1d4ed8' : 'var(--ink-soft)',
                      fontWeight: 600,
                      border: 'none',
                      boxShadow: workingStatus === 'busy' ? 'var(--shadow-sm)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => handleToggleStatus('busy')}
                  >
                    Đang bán hàng
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px', padding: '16px 0' }}>
              <div style={{ color: 'var(--amber-dark)' }}>
                <IconAlertCircle />
              </div>
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: 'var(--ink)' }}>Không có ca làm việc nào đang mở</h4>
                <p style={{ fontSize: '13px', color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }}>
                  Hiện tại đang ngoài khung giờ hoạt động hoặc ca đã được đóng. Ca trực sẽ tự động kích hoạt khi bạn đăng nhập trong khung giờ làm việc.
                </p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: '8px' }}
                  onClick={() => {
                    onClose();
                    navigate('/work-sessions');
                  }}
                >
                  Đến Quản lý ca làm việc
                </button>
              )}
            </div>
          )}
        </div>

        <div className="ws-modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckInModal;
