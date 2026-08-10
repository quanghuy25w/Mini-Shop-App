import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, ShoppingCart, Heart, Star } from 'lucide-react';
import { MOCK_PRODUCTS } from './Products';
import './Pages.css';

const EXTRA_INFO = {
  1: { desc: 'Áo thun chất liệu cotton 100% cao cấp, co giãn 4 chiều, thoáng mát và thấm hút mồ hôi tốt. Form oversize phù hợp mọi vóc dáng.', color: 'Trắng / Đen / Be', size: 'S / M / L / XL / XXL' },
  2: { desc: 'Giày sneaker thiết kế urban hiện đại, đế cao su chống trơn trượt, lót giày êm ái. Phù hợp đi học, đi làm hoặc dạo phố.', color: 'Trắng / Đen / Xanh Navy', size: '39 / 40 / 41 / 42 / 43' },
  3: { desc: 'Túi tote da bò thật nhập khẩu, khóa kéo YKK bền chắc, nhiều ngăn tiện dụng. Thiết kế tối giản, sang trọng.', color: 'Caramel / Đen / Nâu', size: 'One size' },
  4: { desc: 'Đồng hồ minimalist mặt kính sapphire chống xước, chống nước 50m, dây da Italy thay thế dễ dàng. Pin Miyota Nhật.', color: 'Silver / Gold / Rose Gold', size: '38mm / 40mm' },
  5: { desc: 'Kính mát tròng phân cực UV400 chống tia cực tím tối đa, gọng nhựa TR90 siêu nhẹ, bền và không gây dị ứng.', color: 'Đen / Tortoise / Xanh', size: 'One size' },
  6: { desc: 'Nước hoa EDP nhập khẩu chính hãng, nồng độ cao lưu hương 10–12 giờ. Mùi hương sang trọng, gỗ đàn hương và hoa nhài.', color: 'N/A', size: '50ml / 100ml' },
};

function ProductDetail() {
  const { id } = useParams();
  const product = MOCK_PRODUCTS.find((p) => p.id === Number(id));
  const info = EXTRA_INFO[id];

  if (!product) {
    return (
      <div className="page">
        <div className="page__hero">
          <h1 className="page__title">Không tìm thấy sản phẩm</h1>
          <Link to="/products" className="btn btn--primary">Quay lại</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/products" className="detail-back">
        <ChevronLeft size={16} />
        Sản Phẩm
      </Link>

      <div className="detail-container">
        <div className="detail-img-wrap">
          <img src={product.image} alt={product.name} className="detail-img" />
        </div>

        <div className="detail-info">
          <div className="detail-stars">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={14} fill={i < 4 ? '#f59e0b' : 'none'} stroke={i < 4 ? '#f59e0b' : '#555'} />
            ))}
            <span className="detail-reviews">(128 đánh giá)</span>
          </div>

          <h1 className="detail-name">{product.name}</h1>
          <p className="detail-price">{product.price.toLocaleString('vi-VN')}₫</p>
          <p className="detail-desc">{info?.desc}</p>

          <div className="detail-meta">
            <div className="detail-meta__row">
              <span className="detail-meta__label">Màu sắc</span>
              <span className="detail-meta__val">{info?.color}</span>
            </div>
            <div className="detail-meta__row">
              <span className="detail-meta__label">Kích cỡ</span>
              <span className="detail-meta__val">{info?.size}</span>
            </div>
          </div>

          <div className="detail-actions">
            <button className="btn btn--primary">
              <ShoppingCart size={16} />
              Thêm vào giỏ hàng
            </button>
            <button className="btn btn--icon" aria-label="Yêu thích">
              <Heart size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductDetail;
