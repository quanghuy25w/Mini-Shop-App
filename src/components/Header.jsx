import { NavLink } from 'react-router-dom';
import { ShoppingBag, ShoppingCart, Store, Home } from 'lucide-react';
import './Header.css';

function Header() {
  const navClass = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link');

  return (
    <header className="header">
      <div className="header__inner">
        <NavLink to="/" className="header__logo">
          <ShoppingBag size={20} strokeWidth={2.5} />
          <span>Mini<strong>Shop</strong></span>
        </NavLink>

        <nav className="header__nav">
          <NavLink to="/" end className={navClass}>
            <Home size={15} />
            Trang Chủ
          </NavLink>
          <NavLink to="/products" className={navClass}>
            <Store size={15} />
            Sản Phẩm
          </NavLink>
          <NavLink to="/cart" className={navClass}>
            <ShoppingCart size={15} />
            Giỏ Hàng
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default Header;
