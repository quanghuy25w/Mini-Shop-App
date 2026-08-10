import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import './Pages.css';

export const MOCK_PRODUCTS = [
  { id: 1, name: 'Sữa Tươi Vinamilk 100% 1L',  price: 32000,  tag: 'Bán chạy', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&q=80', unit: 'hộp', brand: 'Vinamilk' },
  { id: 2, name: 'Sữa Bột Nan Optipro 800g',     price: 425000, tag: 'Mới',      image: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=500&q=80', unit: 'hộp', brand: 'Nestlé' },
  { id: 3, name: 'Phô Mai Con Bò Cười 200g',     price: 89000,  tag: '',         image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=500&q=80', unit: 'hộp', brand: 'Bel' },
  { id: 4, name: 'Sữa Chua Vinamilk Probi',      price: 18000,  tag: 'Sale',     image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&q=80', unit: 'hộp', brand: 'Vinamilk' },
  { id: 5, name: 'Bơ Lạt Anchor 250g',           price: 145000, tag: '',         image: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=500&q=80', unit: 'hộp', brand: 'Anchor' },
  { id: 6, name: 'Sữa Đặc Ông Thọ 380g',         price: 35000,  tag: '',         image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=500&q=80', unit: 'lon',  brand: 'Vinamilk' },
];

function Products() {
  return (
    <div className="page">
      <div className="products-header">
        <h1>Sản Phẩm Sữa</h1>
        <p>Hiển thị {MOCK_PRODUCTS.length} sản phẩm</p>
      </div>

      <div className="product-grid">
        {MOCK_PRODUCTS.map((p) => (
          <div key={p.id} className="product-card">
            <Link to={`/products/${p.id}`} className="product-card__img-wrap">
              {p.tag && <span className="product-card__tag">{p.tag}</span>}
              <img src={p.image} alt={p.name} />
            </Link>
            <div className="product-card__content">
              <span className="product-card__brand">{p.brand}</span>
              <Link to={`/products/${p.id}`} className="product-card__name">{p.name}</Link>
              <div className="product-card__footer">
                <span className="product-card__price">{p.price.toLocaleString('vi-VN')}₫</span>
                <button className="btn btn--primary btn--icon" title="Thêm vào giỏ">
                  <ShoppingCart size={16} strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Products;
