import { Link } from 'react-router-dom';
import { ShoppingBag, ArrowRight, Zap, ShieldCheck, RefreshCw, Tag } from 'lucide-react';
import './Pages.css';

const FEATURES = [
  { icon: Zap,         title: 'Giao nhanh',         desc: 'Nhận hàng trong 2 giờ nội thành, miễn phí vận chuyển cho đơn từ 500k.' },
  { icon: ShieldCheck, title: 'Thanh toán an toàn',  desc: 'Mã hoá SSL 256-bit, hỗ trợ ví điện tử và thẻ quốc tế.' },
  { icon: RefreshCw,   title: 'Đổi trả dễ dàng',    desc: 'Hoàn tiền 100% trong 30 ngày nếu sản phẩm lỗi hoặc không vừa ý.' },
  { icon: Tag,         title: 'Ưu đãi mỗi ngày',     desc: 'Flash sale lúc 12:00 hàng ngày, giảm đến 50% nhiều danh mục.' },
];

function Home() {
  return (
    <div className="home">

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="hero">
        <div className="hero__text">
          <p className="hero__eyebrow">Bộ sưu tập mới — Hè 2025</p>

          <h1 className="hero__heading">
            Phong cách của bạn,<br />
            <span className="hero__heading--accent">giá thật tốt.</span>
          </h1>

          <p className="hero__body">
            Khám phá hàng nghìn sản phẩm thời trang cao cấp được tuyển chọn kỹ lưỡng — từ trang phục đến phụ kiện — với mức giá cạnh tranh nhất thị trường.
          </p>

          <div className="hero__actions">
            <Link to="/products" className="btn-solid">
              <ShoppingBag size={16} strokeWidth={2} />
              Mua sắm ngay
              <ArrowRight size={16} strokeWidth={2} />
            </Link>
            <Link to="/cart" className="btn-outline">
              Xem giỏ hàng
            </Link>
          </div>

          <div className="hero__stats">
            <div className="hero__stat">
              <span className="hero__stat-num">12k+</span>
              <span className="hero__stat-label">Sản phẩm</span>
            </div>
            <div className="hero__stat-divider" />
            <div className="hero__stat">
              <span className="hero__stat-num">98%</span>
              <span className="hero__stat-label">Hài lòng</span>
            </div>
            <div className="hero__stat-divider" />
            <div className="hero__stat">
              <span className="hero__stat-num">2h</span>
              <span className="hero__stat-label">Giao nhanh</span>
            </div>
          </div>
        </div>

        <div className="hero__visual">
          <div className="hero__img-frame">
            <img
              src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=720&q=80"
              alt="Bộ sưu tập thời trang"
              className="hero__img"
            />
          </div>
          <div className="hero__img-badge">
            <span className="hero__img-badge-dot" />
            Mới mỗi tuần
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────── */}
      <section className="features">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="feat-card">
            <div className="feat-card__icon">
              <Icon size={18} strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="feat-card__title">{title}</h3>
              <p className="feat-card__desc">{desc}</p>
            </div>
          </div>
        ))}
      </section>

    </div>
  );
}

export default Home;
