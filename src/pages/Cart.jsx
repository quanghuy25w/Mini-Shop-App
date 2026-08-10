import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, ArrowRight, ChevronLeft, Tag, Truck } from 'lucide-react';
import { MOCK_PRODUCTS } from './Products';
import './Pages.css';

const MOCK_CART = [
  { id: 1, qty: 2 },
  { id: 4, qty: 3 },
];

function Cart() {
  const cartItems = MOCK_CART.map(({ id, qty }) => {
    const p = MOCK_PRODUCTS.find((p) => p.id === id);
    return { ...p, qty };
  });

  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <div className="page">
      <div className="cart-header">
        <h1>Giỏ hàng</h1>
      </div>

      <div className="cart-layout">

        {/* Left — items */}
        <div>
          <div className="cart-list">
            {cartItems.map((item) => (
              <div key={item.id} className="cart-item">
                <img src={item.image} alt={item.name} className="cart-item__img" />

                <div className="cart-item__info">
                  <span className="cart-item__name">{item.name}</span>
                  <span className="cart-item__brand">{item.brand}</span>
                  <span className="cart-item__price">{item.price.toLocaleString('vi-VN')}₫ / {item.unit}</span>
                </div>

                <div className="cart-item__qty">
                  <button className="cart-item__qty-btn" aria-label="Giảm">
                    <Minus size={13} strokeWidth={2.5} />
                  </button>
                  <span>{item.qty}</span>
                  <button className="cart-item__qty-btn" aria-label="Tăng">
                    <Plus size={13} strokeWidth={2.5} />
                  </button>
                </div>

                <p className="cart-item__subtotal">
                  {(item.price * item.qty).toLocaleString('vi-VN')}₫
                </p>

                <button className="cart-item__remove" aria-label="Xoá">
                  <Trash2 size={15} strokeWidth={1.8} />
                </button>
              </div>
            ))}

            <Link to="/products" className="cart-continue">
              <ChevronLeft size={15} />
              Tiếp tục mua sắm
            </Link>
          </div>
        </div>

        {/* Right — summary */}
        <aside className="cart-summary">
          <h3 className="cart-summary__title">Tóm tắt đơn hàng</h3>

          <div className="cart-summary__body">
            <div className="cart-summary__row">
              <span>Tạm tính ({cartItems.length} sản phẩm)</span>
              <strong>{subtotal.toLocaleString('vi-VN')}₫</strong>
            </div>
            <div className="cart-summary__row cart-summary__row--shipping">
              <span style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <Truck size={14} strokeWidth={1.8} /> Phí vận chuyển
              </span>
              <strong>Miễn phí</strong>
            </div>

            <div className="cart-summary__coupon">
              <input
                type="text"
                placeholder="Mã giảm giá"
                className="cart-summary__input"
              />
              <button className="btn btn--ghost btn--sm" style={{ whiteSpace:'nowrap' }}>
                <Tag size={14} /> Áp dụng
              </button>
            </div>
          </div>

          <div className="cart-summary__total">
            <span>Tổng cộng</span>
            <span>{subtotal.toLocaleString('vi-VN')}₫</span>
          </div>

          <button className="cart-summary__checkout">
            Thanh toán ngay
            <ArrowRight size={16} strokeWidth={2} />
          </button>

          <p className="cart-summary__note">
            Bảo mật SSL 256-bit · Đổi trả trong 30 ngày
          </p>
        </aside>
      </div>
    </div>
  );
}

export default Cart;
