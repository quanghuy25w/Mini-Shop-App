import { useState } from 'react';
import { useWorkSession } from '../../hooks/useWorkSession';
import { useAuth } from '../../hooks/useAuth';
import CheckInModal from './CheckInModal';
import './WorkSessionBanner.css';

const IconAlertCircle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

const IconCheckCircle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

const IconToggleRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="5" width="22" height="14" rx="7" ry="7"></rect>
    <circle cx="16" cy="12" r="3"></circle>
  </svg>
);

const IconToggleLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="5" width="22" height="14" rx="7" ry="7"></rect>
    <circle cx="8" cy="12" r="3"></circle>
  </svg>
);

const WorkSessionBanner = () => {
  const { currentSession, isCheckedIn, workingStatus, updateWorkingStatus } = useWorkSession();
  const { isStaff, isAdmin } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleToggleWorkingStatus = async () => {
    const newStatus = workingStatus === 'busy' ? 'active' : 'busy';
    try {
      await updateWorkingStatus(newStatus);
    } catch (err) {
      console.error('Lỗi khi đổi trạng thái làm việc:', err);
    }
  };

  if (!isCheckedIn && isStaff) {
    return (
      <>
        <div className="ws-banner ws-banner-warning">
          <div className="ws-banner-content">
            <span className="ws-banner-icon"><IconAlertCircle /></span>
            <div className="ws-banner-text">
              <strong>Hiện chưa có ca làm việc đang mở.</strong>
              <span style={{ color: 'var(--ink-soft)' }}> (Ngoài giờ hoạt động, giao dịch bị tạm khóa)</span>
            </div>
          </div>
        </div>

        {isModalOpen && (
          <CheckInModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        )}
      </>
    );
  }

  if (!isCheckedIn && isAdmin) {
    return (
      <>
        <div className="ws-banner ws-banner-warning">
          <div className="ws-banner-content">
            <span className="ws-banner-icon"><IconAlertCircle /></span>
            <div className="ws-banner-text">
              <strong>Hiện chưa có ca làm việc đang mở.</strong>
              <span style={{ color: 'var(--ink-soft)' }}> Xem chi tiết trong Quản lý ca làm việc.</span>
            </div>
          </div>
        </div>

        {isModalOpen && (
          <CheckInModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <div className="ws-banner ws-banner-success">
        <div className="ws-banner-content">
          <span className="ws-banner-icon"><IconCheckCircle /></span>
          <div className="ws-banner-text">
            <span>Ca trực: <strong>{currentSession?.name || 'Ca làm việc'}</strong> <span className="font-mono text-subtle">({currentSession?.code})</span></span>
            <span className="ws-banner-divider">•</span>
            <span>Trạng thái: <strong style={{ color: workingStatus === 'busy' ? '#1d4ed8' : 'var(--ledger-dark)' }}>{workingStatus === 'busy' ? 'Đang bán hàng' : 'Hoạt động'}</strong></span>
          </div>
        </div>

        <div className="ws-banner-actions">
          <button
            type="button"
            className="ws-banner-btn-toggle"
            onClick={handleToggleWorkingStatus}
            title="Đổi trạng thái làm việc"
          >
            {workingStatus === 'busy' ? <IconToggleRight /> : <IconToggleLeft />}
            {workingStatus === 'busy' ? 'Chuyển Hoạt động' : 'Chuyển Đang bán'}
          </button>
          <button
            type="button"
            className="ws-banner-btn-info"
            onClick={() => setIsModalOpen(true)}
          >
            Chi tiết ca
          </button>
        </div>
      </div>

      {isModalOpen && (
        <CheckInModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
};

export default WorkSessionBanner;
