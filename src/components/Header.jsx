import { NavLink } from 'react-router-dom';
import { Droplets, ShoppingCart } from 'lucide-react';
import './Header.css';

function Header() {
  const navClass = ({ isActive }) =>
    isActive ? 'header__nav-link active' : 'header__nav-link';

  return (
    <header className="header">
      <div className="header__container">
        <NavLink to="/" className="header__logo">
          <Droplets className="header__logo-icon" size={22} strokeWidth={2.2} />
          LaCté
        </NavLink>

        <nav className="header__nav">
          <NavLink to="/" end className={navClass}>Trang Chủ</NavLink>
          <NavLink to="/products" className={navClass}>Sản Phẩm</NavLink>
        </nav>

        <NavLink to="/cart" className="header__cart" aria-label="Giỏ hàng">
          <ShoppingCart size={20} strokeWidth={1.8} />
        </NavLink>
      </div>
    </header>
  );
}

export default Header;
