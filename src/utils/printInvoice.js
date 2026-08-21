import { formatCurrency } from './formatCurrency';
import { format } from 'date-fns';

/**
 * In hóa đơn bán hàng độc lập qua iframe ẩn
 * Đảm bảo 100% không bị trắng trang, không bị xung đột CSS layout hoặc overflow:hidden của SPA
 */
export const printInvoice = (order) => {
  if (!order) return;

  const totalQty = order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const formattedDate = order.createdAt 
    ? format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm') 
    : format(new Date(), 'dd/MM/yyyy HH:mm');

  // Tạo iframe chuyên dụng
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';

  document.body.appendChild(iframe);

  const subtotalValue = (order.subtotal !== undefined && order.subtotal !== null)
    ? order.subtotal
    : (order.items?.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0) || 0);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    window.print();
    return;
  }

  const invoiceHtml = `
    <!DOCTYPE html>
    <html lang="vi">
      <head>
        <meta charset="UTF-8" />
        <title>Hóa đơn - ${order.code || 'MiniShop'}</title>
        <style>
          @page {
            size: auto;
            margin: 5mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #000000;
          }
          body {
            width: 100%;
            max-width: 80mm;
            margin: 0 auto;
            padding: 6px;
            font-size: 12px;
            line-height: 1.4;
            background: #ffffff;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-bold { font-weight: 700; }
          .font-mono { font-family: "Courier New", Courier, monospace; }
          
          .store-brand {
            font-size: 18px;
            font-weight: 800;
            text-align: center;
            letter-spacing: 0.05em;
            margin-bottom: 2px;
          }
          .store-sub {
            font-size: 11px;
            text-align: center;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          .store-info {
            font-size: 11px;
            text-align: center;
            margin-bottom: 2px;
          }
          
          .divider {
            border-top: 1px dashed #000000;
            margin: 8px 0;
          }
          
          .invoice-title {
            font-size: 15px;
            font-weight: 800;
            text-align: center;
            text-transform: uppercase;
            margin: 6px 0;
          }
          
          .invoice-meta {
            font-size: 11.5px;
            margin-bottom: 4px;
          }
          .invoice-meta div {
            margin-bottom: 2px;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 6px 0;
            font-size: 11.5px;
          }
          th {
            border-bottom: 1px solid #000000;
            padding: 5px 2px;
            font-weight: 700;
            font-size: 11px;
            text-transform: uppercase;
          }
          td {
            padding: 5px 2px;
            border-bottom: 1px dashed #cccccc;
            vertical-align: top;
          }
          
          .summary-section {
            margin-top: 4px;
            font-size: 11.5px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 3px;
          }
          .grand-total {
            font-size: 14px;
            font-weight: 800;
            padding-top: 4px;
          }
          .grand-total-amount {
            font-size: 15px;
            font-weight: 800;
          }
          
          .footer-section {
            text-align: center;
            margin-top: 10px;
            font-size: 11px;
          }
          .footer-section .vat-note {
            font-style: italic;
            font-size: 10.5px;
            margin-bottom: 4px;
          }
          .footer-section .thank-you {
            font-weight: 700;
            font-size: 12px;
            margin-bottom: 2px;
          }
          .footer-section .website {
            color: #555555;
          }
        </style>
      </head>
      <body>
        <div class="store-brand">MINI-SHOP</div>
        <div class="store-sub">CỬA HÀNG TIỆN LỢI & BÁN LẺ</div>
        <div class="store-info">Đ/C: 123 Đường Bán Hàng, Q.1, TP.HCM</div>
        <div class="store-info">Hotline: 1900 6868</div>

        <div class="divider"></div>

        <div class="invoice-title">HÓA ĐƠN BÁN HÀNG</div>
        <div class="invoice-meta">
          <div>Mã HĐ: <strong>${order.code || ''}</strong></div>
          <div>Ngày: ${formattedDate}</div>
          <div>Thu ngân: Nhân viên bán hàng</div>
        </div>

        <div class="divider"></div>

        <table>
          <thead>
            <tr>
              <th class="text-left">Tên món</th>
              <th class="text-center" style="width: 32px;">SL</th>
              <th class="text-right" style="width: 70px;">Đ.Giá</th>
              <th class="text-right" style="width: 75px;">T.Tiền</th>
            </tr>
          </thead>
          <tbody>
            ${(order.items || []).map(item => `
              <tr>
                <td class="text-left">${item.productName || ''}</td>
                <td class="text-center font-mono">${item.quantity || 0}</td>
                <td class="text-right font-mono">${formatCurrency(item.price || 0)}</td>
                <td class="text-right font-mono font-bold">${formatCurrency((item.price || 0) * (item.quantity || 0))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="divider"></div>

        <div class="summary-section">
          <div class="summary-row">
            <span>Tổng số lượng:</span>
            <span class="font-mono">${totalQty} sản phẩm</span>
          </div>
          <div class="summary-row">
            <span>Tạm tính:</span>
            <span class="font-mono">${formatCurrency(subtotalValue)}</span>
          </div>
          ${order.discountAmount > 0 ? `
            <div class="summary-row">
              <span>Giảm giá${order.discountType === 'percent' && order.discountValue ? ` (${order.discountValue}%)` : ''}:</span>
              <span class="font-mono">-${formatCurrency(order.discountAmount)}</span>
            </div>
          ` : ''}
          <div class="summary-row grand-total">
            <span>TỔNG CỘNG:</span>
            <span class="grand-total-amount font-mono">${formatCurrency(order.totalAmount || 0)}</span>
          </div>
        </div>

        <div class="divider"></div>

        <div class="footer-section">
          <div class="vat-note">(Giá trên đã bao gồm thuế GTGT)</div>
          <div class="thank-you">CẢM ƠN QUÝ KHÁCH & HẸN GẶP LẠI!</div>
          <div class="website">www.mini-shop.vn</div>
        </div>
      </body>
    </html>
  `;

  doc.open();
  doc.write(invoiceHtml);
  doc.close();

  // Đợi nạp xong rồi kích hoạt in
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.warn("Lỗi in qua iframe, chuyển sang fallback:", e);
      window.print();
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1500);
    }
  }, 200);
};
