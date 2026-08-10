import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import './Pages.css';



export const MOCK_PRODUCTS = [
  {
    id: 1,
    name: 'Áo Thun Oversize Cotton',
    price: 299000,
    tag: 'Bán chạy',
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80',
  },
  {
    id: 2,
    name: 'Giày Sneaker Urban',
    price: 899000,
    tag: 'Mới',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80',
  },
  {
    id: 3,
    name: 'Túi Tote Da Thật',
    price: 1299000,
    tag: 'Hot',
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&q=80',
  },
  {
    id: 4,
    name: 'Đồng Hồ Minimalist',
    price: 2499000,
    tag: '',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80',
  },
  {
    id: 5,
    name: 'Kính Mát Polarized',
    price: 399000,
    tag: 'Sale',
    image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=400&q=80',
  },
  {
    id: 6,
    name: 'Nước Hoa EDP',
    price: 1799000,
    tag: '',
    image: 'https://images.unsplash.com/photo-1541643600914-78b084683702?w=400&q=80',
  },
];

function formatPrice(price) {
  return price.toLocaleString('vi-VN') + '₫';
}

function Products() {
  return (
    <div className="page">
      <div className="page__header">
        <h1 className="page__title page__title--sm">Tất Cả Sản Phẩm</h1>
        <p className="page__subtitle">
          Tìm thấy <strong>{MOCK_PRODUCTS.length}</strong> sản phẩm
        </p>
      </div>

      <div className="product-grid">
        {MOCK_PRODUCTS.map((p) => (
          <div key={p.id} className="product-card">
            {p.tag && <span className="product-card__tag">{p.tag}</span>}
            <Link to={`/products/${p.id}`} className="product-card__img-wrap">
              <img src={p.image} alt={p.name} className="product-card__img" />
            </Link>
            <div className="product-card__body">
              <Link to={`/products/${p.id}`} className="product-card__name">{p.name}</Link>
              <p className="product-card__price">{formatPrice(p.price)}</p>
              <button className="btn btn--primary btn--sm btn--full">
                <ShoppingCart size={14} />
                Thêm vào giỏ
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Products;
