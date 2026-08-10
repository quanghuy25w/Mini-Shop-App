import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import './Pages.css';

function NotFound() {
  return (
    <div className="page">
      <div className="notfound">
        <div className="notfound__code">404</div>
        <h1 className="notfound__title">Trang không tồn tại</h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 'var(--t-sm)', marginTop: '-8px' }}>
          Trang bạn tìm kiếm không tồn tại hoặc đã bị xoá.
        </p>
        <Link to="/" className="btn btn--primary">
          <Home size={16} strokeWidth={2} />
          Về Trang Chủ
        </Link>
      </div>
    </div>
  );
}

export default NotFound;
