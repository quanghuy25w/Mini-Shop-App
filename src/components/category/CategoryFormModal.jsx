import { useState } from 'react';
import { generateId } from '../../utils/generateId';
import './CategoryFormModal.css';

const CategoryFormModal = ({ isOpen, onClose, onSubmit, initialData, categories }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevInitialData, setPrevInitialData] = useState(initialData);

  if (prevIsOpen !== isOpen || prevInitialData !== initialData) {
    setPrevIsOpen(isOpen);
    setPrevInitialData(initialData);
    if (isOpen) {
      setName(initialData ? initialData.name : '');
      setDescription(initialData ? (initialData.description || '') : '');
      setError('');
    }
  }

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Tên danh mục không được để trống');
      return;
    }
    
    // Kiểm tra trùng tên (không phân biệt hoa thường)
    const isDuplicate = categories.some(cat => 
      cat.name.toLowerCase() === trimmedName.toLowerCase() && cat.id !== initialData?.id
    );

    if (isDuplicate) {
      setError('Tên danh mục đã tồn tại');
      return;
    }

    const data = {
      id: initialData ? initialData.id : generateId(),
      name: trimmedName,
      description: description.trim()
    };

    onSubmit(data);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>{initialData ? 'Sửa Danh mục' : 'Thêm Danh mục mới'}</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Tên danh mục (*)</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }} 
              placeholder="Nhập tên danh mục"
              autoFocus
            />
            {error && <span className="error-text">{error}</span>}
          </div>
          <div className="form-group">
            <label>Mô tả</label>
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Nhập mô tả chi tiết"
              rows={3}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn-submit">Lưu</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CategoryFormModal;
