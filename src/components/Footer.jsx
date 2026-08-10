import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer__container">
        <div className="footer__brand">LaCté</div>
        <div className="footer__copyright">
          © {new Date().getFullYear()} LaCté. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
