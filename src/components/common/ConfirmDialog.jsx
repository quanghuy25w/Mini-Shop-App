import './ConfirmDialog.css';

const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, showCancel = true }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content confirm-dialog">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          {showCancel && <button className="btn-cancel" onClick={onCancel}>Hủy</button>}
          <button className="btn-submit" onClick={onConfirm}>Đồng ý</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
