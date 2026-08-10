import { Link } from 'react-router-dom';
import { ShoppingBag, ArrowRight, Zap, ShieldCheck, RefreshCw, Tag } from 'lucide-react';
import './Pages.css';

function Home() {
  return (
    <div className="page">
      <div className="home">

        {/* ── Hero ── */}
        <section className="hero">
          <div className="hero__content">
            <span className="hero__eyebrow">
              Sữa &amp; Dinh Dưỡng Uy Tín
            </span>

            <h1 className="hero__heading">
              Dinh dưỡng chuẩn<br />khoa học, chất<br />lượng kiểm định.
            </h1>

            <p className="hero__body">
              Hơn 200 sản phẩm sữa và dinh dưỡng cao cấp, được chứng nhận HACCP &amp; ISO 22000,
              giao nhanh 2 giờ tại nhà.
            </p>

            <div className="hero__actions">
              <Link to="/products" className="btn btn--primary">
                <ShoppingBag size={16} strokeWidth={2} />
                Xem sản phẩm
                <ArrowRight size={16} strokeWidth={2} />
              </Link>
              <Link to="/cart" className="btn btn--ghost">
                Giỏ hàng
              </Link>
            </div>

            <div className="hero__stats">
              <div className="hero__stat">
                <span className="hero__stat-value">200+</span>
                <span className="hero__stat-label">Sản phẩm</span>
              </div>
              <div className="hero__stat">
                <span className="hero__stat-value">4.9★</span>
                <span className="hero__stat-label">Đánh giá</span>
              </div>
              <div className="hero__stat">
                <span className="hero__stat-value">2h</span>
                <span className="hero__stat-label">Giao hàng</span>
              </div>
            </div>
          </div>

          <div className="hero__image-wrap">
            <img
              src="https://images.unsplash.com/photo-1563636619-e9143da7973b?w=800&q=80"
              alt="Sản phẩm sữa NutriMilk"
            />
            <div className="hero__badge">
              <span className="hero__badge-dot" />
              Kiểm định HACCP
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="features">
          <div className="feat-card">
            <div className="feat-card__icon"><Zap size={20} strokeWidth={1.8} /></div>
            <div className="feat-card__content">
              <h3 className="feat-card__title">Giao nhanh 2 giờ</h3>
              <p className="feat-card__desc">Miễn phí vận chuyển cho đơn từ 500.000₫</p>
            </div>
          </div>
          <div className="feat-card">
            <div className="feat-card__icon"><ShieldCheck size={20} strokeWidth={1.8} /></div>
            <div className="feat-card__content">
              <h3 className="feat-card__title">Kiểm định chất lượng</h3>
              <p className="feat-card__desc">Đạt chuẩn HACCP, ISO 22000 quốc tế</p>
            </div>
          </div>
          <div className="feat-card">
            <div className="feat-card__icon"><RefreshCw size={20} strokeWidth={1.8} /></div>
            <div className="feat-card__content">
              <h3 className="feat-card__title">Đổi trả dễ dàng</h3>
              <p className="feat-card__desc">30 ngày hoàn tiền 100% không điều kiện</p>
            </div>
          </div>
          <div className="feat-card">
            <div className="feat-card__icon"><Tag size={20} strokeWidth={1.8} /></div>
            <div className="feat-card__content">
              <h3 className="feat-card__title">Giá tốt mỗi ngày</h3>
              <p className="feat-card__desc">Cam kết rẻ hơn siêu thị, cập nhật liên tục</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

export default Home;
