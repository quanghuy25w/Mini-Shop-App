import React from 'react';
import { Milk } from 'lucide-react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer__container">
        <div className="footer__brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Milk size={20} color="#2563eb" strokeWidth={2} />
          NutriMilk
        </div>
        <div className="footer__copyright">
          © {new Date().getFullYear()} NutriMilk. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
