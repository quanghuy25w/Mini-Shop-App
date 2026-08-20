import React from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '../../utils/formatCurrency';
import { format } from 'date-fns';
import { printInvoice } from '../../utils/printInvoice';
import './InvoiceModal.css';

const InvoiceModal = ({ isOpen, order, onClose }) => {
  if (!isOpen || !order) return null;

  const totalQty = order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const subtotalValue = (order.subtotal !== undefined && order.subtotal !== null)
    ? order.subtotal
    : (order.items?.reduce((s, i) => s + i.price * i.quantity, 0) || 0);

  const modalContent = (
    <div className="modal-overlay invoice-modal-overlay">
      <div className="modal-content invoice-modal">
        {/* RECEIPT HEADER */}
        <div className="invoice-header">
          <div className="store-brand">MINI-SHOP</div>
          <div className="store-sub">CỬA HÀNG TIỆN LỢI & BÁN LẺ</div>
          <div className="store-info">Đ/C: 123 Đường Bán Hàng, Q.1, TP.HCM</div>
          <div className="store-info">Hotline: 1900 6868</div>

          <div className="receipt-divider"></div>

          <h2 className="receipt-title">Hóa Đơn Bán Hàng</h2>
          <div className="receipt-meta">
            <div>Mã HĐ: <strong>{order.code}</strong></div>
            <div>Ngày: {format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm')}</div>
            <div>Thu ngân: Nhân viên bán hàng</div>
          </div>
        </div>

        {/* RECEIPT BODY */}
        <div className="invoice-body">
          <table className="invoice-table">
            <thead>
              <tr>
                <th className="text-left">Tên món</th>
                <th className="text-center" width="40px">SL</th>
                <th className="text-right" width="80px">Đ.Giá</th>
                <th className="text-right" width="90px">T.Tiền</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item, index) => (
                <tr key={index}>
                  <td className="text-left item-name-cell">{item.productName}</td>
                  <td className="text-center font-mono">{item.quantity}</td>
                  <td className="text-right font-mono">{formatCurrency(item.price)}</td>
                  <td className="text-right font-mono font-bold">{formatCurrency(item.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="receipt-divider"></div>
          
          <div className="invoice-total">
            <div className="invoice-total-row">
              <span>Tổng số lượng:</span>
              <span className="font-mono">{totalQty} sản phẩm</span>
            </div>
            <div className="invoice-total-row">
              <span>Tạm tính:</span>
              <span className="font-mono">{formatCurrency(subtotalValue)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="invoice-total-row invoice-discount-row">
                <span>Giảm giá:</span>
                <span className="font-mono">-{formatCurrency(order.discountAmount)}</span>
              </div>
            )}
            <div className="invoice-total-row invoice-grand-total">
              <span>TỔNG CỘNG:</span>
              <span className="total-amount font-mono">{formatCurrency(order.totalAmount)}</span>
            </div>
          </div>

          <div className="receipt-divider"></div>

          <div className="receipt-footer">
            <p className="vat-note">(Giá trên đã bao gồm thuế GTGT)</p>
            <p className="thank-you">CẢM ƠN QUÝ KHÁCH & HẸN GẶP LẠI!</p>
            <p className="website">www.mini-shop.vn</p>
          </div>
        </div>

        {/* MODAL ACTIONS - HIDDEN ON PRINT */}
        <div className="modal-actions invoice-actions">
          <button type="button" className="btn-primary" onClick={onClose}>Đóng & Trở về</button>
          <button type="button" className="btn-print-bill" onClick={() => printInvoice(order)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            <span>In hóa đơn</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default InvoiceModal;
