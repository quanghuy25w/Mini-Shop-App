import { Link } from 'react-router-dom';
import './Pages.css';

function NotFound() {
  return (
    <div className="page page--center">
      <div className="notfound">
        <div className="notfound__code">404</div>
        <h1 className="notfound__title">Trang Không Tồn Tại</h1>
        <p className="notfound__desc">
          Xin lỗi, trang bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.
        </p>
        <Link to="/" className="btn btn--primary">🏠 Về Trang Chủ</Link>
      </div>
    </div>
  );
}

export default NotFound;
