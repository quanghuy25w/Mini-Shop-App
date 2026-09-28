import '../../pages/WorkSession/WorkSession.css';

const IconClockAlert = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const MemberStatusBadge = ({ attendanceStatus, workingStatus, isLate = false, lateMinutes = 0 }) => {
  return (
    <div className="member-badge-group">
      {attendanceStatus === 'missing_checkout' && (
        <span className="badge-compact badge-brick" title="Thành viên chưa check-out khi ca đóng">
          Quên ra ca
        </span>
      )}

      {attendanceStatus === 'completed' && (
        <span className="badge-compact badge-slate" title="Đã kết thúc ca làm việc hợp lệ">
          Đã rời ca
        </span>
      )}

      {attendanceStatus === 'present' && (
        workingStatus === 'busy' ? (
          <span className="badge-compact badge-blue" title="Đang xử lý thanh toán / giao dịch">
            Đang bán hàng
          </span>
        ) : (
          <span className="badge-compact badge-success" title="Đang hoạt động trong ca trực">
            Hoạt động
          </span>
        )
      )}

      {isLate ? (
        <span className="badge-compact badge-amber" title={`Đi muộn ${lateMinutes || 0} phút so với giờ bắt đầu`}>
          <IconClockAlert /> Muộn {lateMinutes}p
        </span>
      ) : (
        <span className="badge-compact badge-success" style={{ background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }} title="Đúng giờ vào ca">
          <IconCheck /> Đúng giờ
        </span>
      )}
    </div>
  );
};

export default MemberStatusBadge;
