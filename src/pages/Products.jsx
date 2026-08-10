import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import './Pages.css';

export const MOCK_PRODUCTS = [
  { id: 1, name: 'Sữa Tươi Vinamilk 100% 1L',  price: 32000,  tag: 'Bán chạy', image: 'https://cdn.tgdd.vn/Products/Images/2386/79312/bhx/sua-tuoi-tiet-trung-co-duong-vinamilk-100-sua-tuoi-hop-1-lit-202403281405411648.jpg', unit: 'hộp', brand: 'Vinamilk' },
  { id: 2, name: 'Sữa Bột Nan Optipro 800g',     price: 425000, tag: 'Mới',      image: 'https://cdn.kidsplaza.vn/_next/image?url=https%3A%2F%2Fcdn-v2.kidsplaza.vn%2Fmedia%2Fwysiwyg%2Fproduct%2Fsuabotchobe%2Fsua-nan%2Fsua-nan-optipro-plus-so-1-5hmo-800g-cho-be-0-6-thang-tuoi-1.jpg&w=828&q=75', unit: 'hộp', brand: 'Nestlé' },
  { id: 3, name: 'Phô Mai Con Bò Cười 200g',     price: 89000,  tag: '',         image: 'https://cdn.go-vietnam.vn/sale-products/00001832-0.png?v=10', brand: 'Bel' },
  { id: 4, name: 'Sữa Chua Vinamilk Probi',      price: 18000,  tag: 'Sale',     image: 'https://www.lottemart.vn/media/catalog/product/cache/0x0/8/9/8934673304528-1.jpg.webp', unit: 'hộp', brand: 'Vinamilk' },
  { id: 5, name: 'Bơ Lạt Anchor 250g',           price: 145000, tag: '',         image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTxEuKe-1WT-VzCgZhuou6zKtvPanXviO36w57gKk5Qm2ZdNz_E7wLEE7cd&s=10', unit: 'hộp', brand: 'Anchor' },
  { id: 6, name: 'Sữa Đặc Ông Thọ 380g',         price: 35000,  tag: '',         image: 'https://cdn.tgdd.vn/Products/Images/2526/92440/bhx/sua-dac-co-duong-ong-tho-trang-nhan-vang-lon-380g-202306141608258891.jpg', unit: 'lon',  brand: 'Vinamilk' },
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
