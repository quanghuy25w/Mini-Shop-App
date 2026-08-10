import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, ShoppingCart, Heart, Star } from 'lucide-react';
import { MOCK_PRODUCTS } from './Products';
import './Pages.css';

const EXTRA = {
  1: { desc: 'Sữa tươi 100% nguyên chất từ trang trại đạt chuẩn, cung cấp năng lượng và canxi tự nhiên cho cả gia đình mỗi ngày.', origin: 'Việt Nam', storage: 'Bảo quản lạnh sau khi mở nắp, dùng trong 3 ngày', nutrition: 'Năng lượng 60kcal · Canxi 120mg / 100ml' },
  2: { desc: 'Sữa bột công thức Optipro cho trẻ sơ sinh, hỗ trợ tiêu hóa và phát triển trí não với hệ dưỡng chất tối ưu.', origin: 'Thụy Sĩ', storage: 'Nơi khô ráo, thoáng mát, tránh ánh nắng', nutrition: 'DHA · ARA · Optipro Protein' },
  3: { desc: 'Phô mai mềm mịn, giàu canxi và protein, lý tưởng cho bữa ăn nhẹ của trẻ và cả gia đình.', origin: 'Pháp', storage: 'Bảo quản lạnh 2–6°C', nutrition: 'Canxi 600mg · Protein 10g / 100g' },
  4: { desc: 'Sữa chua uống men sống Probi, bổ sung Lactobacillus Casei 431, tốt cho hệ tiêu hóa và tăng cường miễn dịch.', origin: 'Việt Nam', storage: 'Bảo quản lạnh 4–8°C', nutrition: 'Probiotics L. Casei 431 · Canxi 80mg' },
  5: { desc: 'Bơ lạt nguyên chất từ sữa bò ăn cỏ New Zealand, hàm lượng chất béo tự nhiên 82%, tuyệt vời để nướng bánh và nấu ăn.', origin: 'New Zealand', storage: 'Bảo quản lạnh hoặc đông đá', nutrition: 'Chất béo 82% · Năng lượng 720kcal / 100g' },
  6: { desc: 'Sữa đặc có đường đậm đà, vị ngọt thơm đặc trưng, thích hợp pha cà phê, làm bánh và sinh tố.', origin: 'Việt Nam', storage: 'Nơi khô ráo, thoáng mát sau khi mở nắp', nutrition: 'Năng lượng 336kcal · Canxi 300mg / 100g' },
};

function ProductDetail() {
  const { id } = useParams();
  const product = MOCK_PRODUCTS.find((p) => p.id === Number(id));

  if (!product) {
    return (
      <div className="page">
        <h1>Sản phẩm không tồn tại</h1>
        <Link to="/products" className="btn btn--primary" style={{ marginTop: '1rem' }}>Quay lại</Link>
      </div>
    );
  }

  const info = EXTRA[product.id] ?? { desc: '', origin: '—', storage: '—', nutrition: '—' };

  return (
    <div className="page">
      <Link to="/products" className="product-detail__back">
        <ChevronLeft size={16} />
        Sản phẩm
      </Link>

      <div className="product-detail">
        {/* Image */}
        <div className="product-detail__img-col">
          <img src={product.image} alt={product.name} />
        </div>

        {/* Info */}
        <div className="product-detail__info-col">
          <span className="product-detail__brand">{product.brand}</span>

          <h1 className="product-detail__name">{product.name}</h1>

          <div className="product-detail__rating">
            {[1,2,3,4].map((s) => (
              <Star key={s} size={15} fill="currentColor" strokeWidth={0} />
            ))}
            <Star size={15} strokeWidth={1.5} />
            <span>(128 đánh giá)</span>
          </div>

          <div className="product-detail__price">
            {product.price.toLocaleString('vi-VN')}₫
            <small style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--ink-3)', marginLeft: '6px' }}>
              / {product.unit}
            </small>
          </div>

          <p className="product-detail__desc">{info.desc}</p>

          <table className="product-detail__meta">
            <tbody>
              <tr><th>Xuất xứ</th><td>{info.origin}</td></tr>
              <tr><th>Bảo quản</th><td>{info.storage}</td></tr>
              <tr><th>Dinh dưỡng</th><td>{info.nutrition}</td></tr>
            </tbody>
          </table>

          <div className="product-detail__actions">
            <button className="btn btn--primary" style={{ flex: 1 }}>
              <ShoppingCart size={16} strokeWidth={2} />
              Thêm vào giỏ hàng
            </button>
            <button className="btn btn--ghost btn--icon" aria-label="Yêu thích">
              <Heart size={18} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductDetail;
