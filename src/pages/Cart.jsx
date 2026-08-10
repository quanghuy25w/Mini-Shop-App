import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, ArrowRight, ChevronLeft, Tag, Truck } from 'lucide-react';
import { MOCK_PRODUCTS } from './Products';
import './Pages.css';

const MOCK_CART = [
  { id: 1, qty: 2 },
  { id: 2, qty: 1 },
];

function Cart() {
  const cartItems = MOCK_CART.map(({ id, qty }) => {
    const product = MOCK_PRODUCTS.find((p) => p.id === id);
    return { ...product, qty };
  });

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const shipping = 0;
  const total = subtotal + shipping;

  return (
    <div className="page">
      <div className="page__header">
        <h1 className="page__title page__title--sm">Giỏ Hàng</h1>
        <p className="page__subtitle">{cartItems.length} sản phẩm</p>
      </div>

      <div className="cart-container">
        {/* ── Cart Items ─────────────────────────────────── */}
        <div className="cart-list">
          {cartItems.map((item) => (
            <div key={item.id} className="cart-item">
              <img src={item.image} alt={item.name} className="cart-item__img" />

              <div className="cart-item__info">
                <Link to={`/products/${item.id}`} className="cart-item__name">
                  {item.name}
                </Link>
                <p className="cart-item__unit-price">
                  {item.price.toLocaleString('vi-VN')}₫ / cái
                </p>
              </div>

              <div className="cart-item__qty">
                <button className="qty-btn" aria-label="Giảm">
                  <Minus size={13} />
                </button>
                <span className="qty-value">{item.qty}</span>
                <button className="qty-btn" aria-label="Tăng">
                  <Plus size={13} />
                </button>
              </div>

              <p className="cart-item__subtotal">
                {(item.price * item.qty).toLocaleString('vi-VN')}₫
              </p>

              <button className="cart-item__remove" aria-label="Xóa">
                <Trash2 size={15} />
              </button>
            </div>
          ))}

          <Link to="/products" className="cart-continue">
            <ChevronLeft size={15} />
            Tiếp tục mua sắm
          </Link>
        </div>

        {/* ── Order Summary ───────────────────────────────── */}
        <aside className="cart-summary">
          <h3 className="cart-summary__title">Tóm tắt đơn hàng</h3>

          <div className="cart-summary__body">
            <div className="cart-summary__row">
              <span>Tạm tính ({cartItems.length} sản phẩm)</span>
              <span>{subtotal.toLocaleString('vi-VN')}₫</span>
            </div>
            <div className="cart-summary__row">
              <span className="cart-summary__ship-label">
                <Truck size={14} />
                Phí vận chuyển
              </span>
              <span className="text-success">Miễn phí</span>
            </div>

            <div className="cart-summary__coupon">
              <input
                type="text"
                placeholder="Mã giảm giá"
                className="coupon-input"
              />
              <button className="coupon-btn">
                <Tag size={14} />
                Áp dụng
              </button>
            </div>
          </div>

          <div className="cart-summary__total">
            <span>Tổng cộng</span>
            <span>{total.toLocaleString('vi-VN')}₫</span>
          </div>

          <button className="checkout-btn">
            Thanh toán ngay
            <ArrowRight size={16} />
          </button>

          <p className="cart-summary__note">
            Bảo mật bởi SSL 256-bit · Đổi trả trong 30 ngày
          </p>
        </aside>
      </div>
    </div>
  );
}

export default Cart;
