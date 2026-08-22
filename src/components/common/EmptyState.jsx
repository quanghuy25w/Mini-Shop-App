const EmptyState = ({ message = 'Không có dữ liệu' }) => (
  <div style={{ padding: '40px', textAlign: 'center', color: '#999', backgroundColor: '#fff', borderRadius: '8px', border: '1px dashed #ccc' }}>
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', opacity: 0.5 }}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="9" y1="9" x2="15" y2="15"></line>
      <line x1="15" y1="9" x2="9" y2="15"></line>
    </svg>
    <p style={{ margin: 0 }}>{message}</p>
  </div>
);

export default EmptyState;
