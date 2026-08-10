import './Footer.css';

function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <p className="footer__brand">🛍️ MiniShop</p>
        <p className="footer__copy">© {new Date().getFullYear()} MiniShop. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default Footer;
