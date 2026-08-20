import React from 'react';
import { formatCurrency } from '../../utils/formatCurrency';
import { format } from 'date-fns';
import './InvoiceModal.css';

const InvoiceModal = ({ isOpen, order, onClose }) => {
  if (!isOpen || !order) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content invoice-modal">
        <div className="invoice-header">
          <h2>Hóa Đơn Bán Hàng</h2>
          <p>Mã hóa đơn: <strong>{order.code}</strong></p>
          <p>Ngày tạo: {format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm')}</p>
        </div>

        <div className="invoice-body">
          <table className="invoice-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th className="text-center">SL</th>
                <th className="text-right">Đơn giá</th>
                <th className="text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={index}>
                  <td>{item.productName}</td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-right">{formatCurrency(item.price)}</td>
                  <td className="text-right">{formatCurrency(item.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="invoice-total">
            <div className="invoice-total-row">
              <span>Tạm tính:</span>
              <span>{formatCurrency(order.subtotal ?? order.items.reduce((s, i) => s + i.price * i.quantity, 0))}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="invoice-total-row invoice-discount-row">
                <span>Giảm giá:</span>
                <span>-{formatCurrency(order.discountAmount)}</span>
              </div>
            )}
            <div className="invoice-total-row invoice-grand-total">
              <span>Tổng cộng:</span>
              <span className="total-amount">{formatCurrency(order.totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="modal-actions invoice-actions">
          <button className="btn-primary" onClick={onClose}>Đóng & Trở về</button>
          <button className="btn-secondary" onClick={() => window.print()}>In hóa đơn</button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
