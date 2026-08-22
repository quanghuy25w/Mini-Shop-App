import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import SalesPage from '../pages/SalesPage';
import { AppDataProvider } from '../context/AppDataContext';
import { CartProvider } from '../context/CartContext';
import { initSeedData } from '../api/localStorageAdapter';
import axiosClient from '../api/axiosClient';

const renderSalesPage = () => {
  return render(
    <AppDataProvider>
      <CartProvider>
        <BrowserRouter>
          <SalesPage />
        </BrowserRouter>
      </CartProvider>
    </AppDataProvider>
  );
};

describe('Group 4: Bán hàng (SalesPage) Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
  });

  it('Tìm kiếm lọc đúng sản phẩm theo tên hoặc mã', async () => {
    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();
    expect(await screen.findByText('Abbott Ensure Gold 380g (Beta Glucan)', {}, { timeout: 5000 })).toBeTruthy();

    const searchInput = screen.getByPlaceholderText('Tìm kiếm sản phẩm (mã, tên...)');
    fireEvent.change(searchInput, { target: { value: 'Ensure' } });

    // Expect Ensure product card to be displayed
    expect(screen.getByText('Abbott Ensure Gold 380g (Beta Glucan)')).toBeTruthy();

    // Search non-existing product
    fireEvent.change(searchInput, { target: { value: 'Sản phẩm không có xyz' } });
    expect(await screen.findByText(/Không tìm thấy sản phẩm phù hợp/i, {}, { timeout: 5000 })).toBeTruthy();
  });

  it('Sản phẩm có tồn kho = 0 hiển thị "Hết hàng" và không thể thêm vào giỏ', async () => {
    // Set stock of 1 product to 0
    const products = JSON.parse(localStorage.getItem('minishop_products'));
    products[0].stockQuantity = 0;
    localStorage.setItem('minishop_products', JSON.stringify(products));

    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    // Expect "Tồn: 0 (Hết hàng)" or "Hết hàng" badge
    const outCard = await screen.findByText(/Hết hàng/i, {}, { timeout: 5000 });
    expect(outCard).toBeTruthy();

    // Click on out of stock card
    fireEvent.click(outCard.closest('.pos-product-card') || outCard);

    // Cart remains empty
    expect(screen.getByText(/Chưa có sản phẩm trong giỏ hàng/i)).toBeTruthy();
  });

  it('Sửa số lượng trong giỏ vượt quá tồn kho bị chặn và báo lỗi', async () => {
    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    // Add Ensure product to cart
    const prodCard = await screen.findByText('Abbott Ensure Gold 380g (Beta Glucan)', {}, { timeout: 5000 });
    fireEvent.click(prodCard);

    // Find quantity input in cart table
    const qtyInputs = screen.getAllByRole('textbox');
    const cartQtyInput = qtyInputs.find(i => i.classList.contains('spinner-input'));
    expect(cartQtyInput).toBeTruthy();

    // Try setting quantity to 99999
    fireEvent.change(cartQtyInput, { target: { value: '99999' } });

    // Quantity should NOT be set to 99999
    expect(cartQtyInput.value).not.toBe('99999');
  });

  it('Tính đúng thành tiền từng dòng và tổng thanh toán khi thêm, sửa, xóa sản phẩm', async () => {
    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    // Add Ensure 380g (436.000đ) and Ensure 800g (900.000đ)
    const prod1Card = await screen.findByText('Abbott Ensure Gold 380g (Beta Glucan)', {}, { timeout: 5000 });
    fireEvent.click(prod1Card);

    const prod2Card = await screen.findByText('Abbott Ensure Gold 800g (Beta Glucan)', {}, { timeout: 5000 });
    fireEvent.click(prod2Card);

    // Check subtotal in summary (appears in both Tạm tính and Tổng thanh toán)
    expect((await screen.findAllByText(/1\.336\.000/, {}, { timeout: 5000 })).length).toBeGreaterThan(0);

    // Delete one item
    const removeBtns = screen.getAllByTitle('Xóa sản phẩm khỏi giỏ');
    fireEvent.click(removeBtns[0]);

    // Confirm dialog
    expect(screen.getByText('Xóa sản phẩm khỏi giỏ')).toBeTruthy();
    fireEvent.click(screen.getByText('Đồng ý'));

    // Verify item deleted from cart (only present in product catalog list, count = 1)
    await waitFor(() => {
      expect(screen.getAllByText('Abbott Ensure Gold 380g (Beta Glucan)').length).toBe(1);
    }, { timeout: 5000 });
  });

  it('Thanh toán thành công hiển thị Modal Hóa đơn và làm sạch giỏ hàng + trừ tồn kho', async () => {
    // Get initial stock of first product
    const initialProds = await axiosClient.get('/products');
    const testProd = initialProds.data[0];
    const initialStock = testProd.stockQuantity;

    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    // Add product to cart
    const prodCard = await screen.findByText(testProd.name, {}, { timeout: 5000 });
    fireEvent.click(prodCard);

    // Click "Thanh toán (F9)"
    const checkoutBtn = screen.getByRole('button', { name: /Thanh toán \(F9\)/i });
    fireEvent.click(checkoutBtn);

    // Verify Checkout Confirm Modal appears
    expect(await screen.findByText('Xác nhận thanh toán')).toBeTruthy();

    // Click "Thanh toán & In hóa đơn"
    const payAndPrintBtn = screen.getByRole('button', { name: /Thanh toán & In hóa đơn/i });
    fireEvent.click(payAndPrintBtn);

    // Verify Invoice Modal appears
    await waitFor(() => {
      expect(screen.getByText(/Hóa Đơn Bán Hàng/i)).toBeTruthy();
    }, { timeout: 5000 });

    // Close Modal
    const closeBtn = screen.getByText(/Đóng/i);
    fireEvent.click(closeBtn);

    // Verify cart is now empty
    expect(screen.getByText(/Chưa có sản phẩm trong giỏ hàng/i)).toBeTruthy();

    // Verify stock reduced by 1
    const updatedRes = await axiosClient.get(`/products/${testProd.id}`);
    expect(updatedRes.data.stockQuantity).toBe(initialStock - 1);
  });

  it('Chọn "Chỉ thanh toán (không in)" hoàn tất đơn hàng không mở Modal hóa đơn', async () => {
    const initialProds = await axiosClient.get('/products');
    const testProd = initialProds.data[0];

    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    // Add product to cart
    const prodCard = await screen.findByText(testProd.name, {}, { timeout: 5000 });
    fireEvent.click(prodCard);

    // Click "Thanh toán (F9)"
    const checkoutBtn = screen.getByRole('button', { name: /Thanh toán \(F9\)/i });
    fireEvent.click(checkoutBtn);

    // Verify Checkout Confirm Modal appears
    expect(await screen.findByText('Xác nhận thanh toán')).toBeTruthy();

    // Click "Chỉ thanh toán (không in)"
    const payOnlyBtn = screen.getByRole('button', { name: /Chỉ thanh toán \(không in\)/i });
    fireEvent.click(payOnlyBtn);

    // Verify cart is now empty
    await waitFor(() => {
      expect(screen.getByText(/Chưa có sản phẩm trong giỏ hàng/i)).toBeTruthy();
    }, { timeout: 5000 });

    // Modal hóa đơn không hiển thị
    expect(screen.queryByText(/Hóa Đơn Bán Hàng/i)).toBeNull();
  });

  it('Chọn "Hủy thao tác" đóng popup và giữ nguyên giỏ hàng', async () => {
    const initialProds = await axiosClient.get('/products');
    const testProd = initialProds.data[0];

    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    // Add product to cart
    const prodCard = await screen.findByText(testProd.name, {}, { timeout: 5000 });
    fireEvent.click(prodCard);

    // Click "Thanh toán (F9)"
    const checkoutBtn = screen.getByRole('button', { name: /Thanh toán \(F9\)/i });
    fireEvent.click(checkoutBtn);

    // Verify Checkout Confirm Modal appears
    expect(await screen.findByText('Xác nhận thanh toán')).toBeTruthy();

    // Click "Hủy thao tác"
    const cancelBtn = screen.getByRole('button', { name: /Hủy thao tác/i });
    fireEvent.click(cancelBtn);

    // Popup closed
    await waitFor(() => {
      expect(screen.queryByText('Xác nhận thanh toán')).toBeNull();
    }, { timeout: 5000 });

    // Cart still has product
    expect(screen.queryByText(/Chưa có sản phẩm trong giỏ hàng/i)).toBeNull();
  });

  it('Phân trang bán hàng hiển thị 20 sản phẩm/trang ở cả dạng Grid và List, chuyển trang mượt mà', async () => {
    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();
    expect(await screen.findByText('1 - 20', {}, { timeout: 5000 })).toBeTruthy();

    // Chuyển sang chế độ xem danh sách (list view)
    const toggleBtn = screen.getByTitle(/Chuyển sang dạng/i);
    fireEvent.click(toggleBtn);

    // Vẫn hiển thị phân trang
    expect(screen.getByText('1 - 20')).toBeTruthy();

    // Chuyển sang trang 2
    const page2Btn = screen.getByRole('button', { name: '2' });
    fireEvent.click(page2Btn);

    await waitFor(() => {
      expect(screen.getByText('21 - 40')).toBeTruthy();
    });

    // Khi tìm kiếm -> tự reset về trang 1
    const searchInput = screen.getByPlaceholderText('Tìm kiếm sản phẩm (mã, tên...)');
    fireEvent.change(searchInput, { target: { value: 'Ensure' } });

    await waitFor(() => {
      expect(screen.queryByText('21 - 40')).toBeNull();
    });
  });

  it('Tính giảm giá theo % chính xác, giới hạn tối đa 100%, reset khi đổi loại và hiển thị trên hóa đơn', async () => {
    const initialProds = await axiosClient.get('/products');
    const testProd = initialProds.data[0]; // Abbott Ensure Gold 380g, price 436.000đ

    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    // Thêm sản phẩm vào giỏ (436.000đ)
    const prodCard = await screen.findByText(testProd.name, {}, { timeout: 5000 });
    fireEvent.click(prodCard);

    // Chuyển sang giảm giá %
    const percentBtn = screen.getByRole('button', { name: '%' });
    fireEvent.click(percentBtn);
    expect(percentBtn.classList.contains('active')).toBe(true);

    // Tìm ô input giảm giá
    const discountInputs = screen.getAllByRole('spinbutton');
    const discountInput = discountInputs[discountInputs.length - 1];

    // Nhập 10% -> giảm 43.600đ, tổng còn 392.400đ
    fireEvent.change(discountInput, { target: { value: '10' } });

    // Kiểm tra tổng thanh toán cập nhật
    expect(screen.getByText(/392\.400/)).toBeTruthy();

    // Nhập quá 100% (ví dụ 150%) -> tự động clamp về 100%
    fireEvent.change(discountInput, { target: { value: '150' } });
    expect(discountInput.value).toBe('100');
    expect(screen.getByText(/^0\s*₫$/)).toBeTruthy();

    // Đổi lại 10%
    fireEvent.change(discountInput, { target: { value: '10' } });

    // Thanh toán & In hóa đơn để kiểm tra hiển thị trên hóa đơn
    const checkoutBtn = screen.getByRole('button', { name: /Thanh toán \(F9\)/i });
    fireEvent.click(checkoutBtn);

    expect(await screen.findByText('Xác nhận thanh toán')).toBeTruthy();
    expect(screen.getByText(/Giảm giá \(10%\)/i)).toBeTruthy();

    const payAndPrintBtn = screen.getByRole('button', { name: /Thanh toán & In hóa đơn/i });
    fireEvent.click(payAndPrintBtn);

    // Invoice Modal xuất hiện và có dòng "Giảm giá (10%):"
    await waitFor(() => {
      expect(screen.getByText(/Giảm giá \(10%\)/i)).toBeTruthy();
    }, { timeout: 5000 });

    // Đóng hóa đơn
    fireEvent.click(screen.getByText(/Đóng/i));
  });

  it('Lưu đơn hàng tạm (F5), mở modal đơn tạm và nạp lại vào giỏ hàng thành công', async () => {
    localStorage.removeItem('minishop_draft_orders');
    const initialProds = await axiosClient.get('/products');
    const testProd = initialProds.data[0];

    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    // Thêm sản phẩm vào giỏ
    const prodCard = await screen.findByText(testProd.name, {}, { timeout: 5000 });
    fireEvent.click(prodCard);

    // Bấm nút Lưu đơn hàng (F5)
    const saveDraftBtn = screen.getByRole('button', { name: /Lưu đơn hàng \(F5\)/i });
    fireEvent.click(saveDraftBtn);

    // Giỏ hàng bị làm trống
    expect(await screen.findByText(/Chưa có sản phẩm trong giỏ hàng/i)).toBeTruthy();

    // Badge Đơn tạm hiển thị (1)
    const draftBadgeBtn = screen.getByRole('button', { name: /Đơn tạm \(1\)/i });
    expect(draftBadgeBtn).toBeTruthy();

    // Mở Modal Đơn tạm
    fireEvent.click(draftBadgeBtn);
    expect(await screen.findByText('Danh sách đơn hàng tạm')).toBeTruthy();
    expect(screen.getByText(/Đang lưu trữ/i)).toBeTruthy();
    expect(screen.getAllByText(/Ensure Gold 380g/i).length).toBeGreaterThan(0);

    // Bấm "Nạp lại vào giỏ"
    const restoreBtn = screen.getByRole('button', { name: /Nạp lại vào giỏ/i });
    fireEvent.click(restoreBtn);

    // Modal đóng và sản phẩm xuất hiện lại trong giỏ hàng
    await waitFor(() => {
      expect(screen.queryByText('Danh sách đơn hàng tạm')).toBeNull();
    });
    expect(screen.queryByText(/Chưa có sản phẩm trong giỏ hàng/i)).toBeNull();
    expect(screen.getByRole('button', { name: /Đơn tạm \(0\)/i })).toBeTruthy();
  });

  it('Nhập mã sản phẩm hoặc quét mã vạch và nhấn Enter tự động thêm vào giỏ hàng và reset ô tìm kiếm', async () => {
    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    const searchInput = screen.getByPlaceholderText('Tìm kiếm sản phẩm (mã, tên...)');

    // Gõ mã SP001 và nhấn Enter
    fireEvent.change(searchInput, { target: { value: 'SP001' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    // Sản phẩm Abbott Ensure Gold 380g được tự động thêm vào giỏ hàng
    expect(screen.queryByText(/Chưa có sản phẩm trong giỏ hàng/i)).toBeNull();
    expect(screen.getAllByText(/Ensure Gold 380g/i).length).toBeGreaterThan(0);

    // Ô tìm kiếm được tự động xóa sạch để sẵn sàng cho lần gõ tiếp theo
    expect(searchInput.value).toBe('');
  });

  it('Khi tìm kiếm trả về nhiều hơn 1 kết quả, nhấn Enter KHÔNG tự ý thêm sản phẩm và giữ nguyên input', async () => {
    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    const searchInput = screen.getByPlaceholderText('Tìm kiếm sản phẩm (mã, tên...)');

    // Gõ "Ensure" (có nhiều sản phẩm Ensure 380g, 800g...)
    fireEvent.change(searchInput, { target: { value: 'Ensure' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    // Giỏ hàng vẫn trống, KHÔNG tự động thêm sản phẩm đầu tiên
    expect(screen.getByText(/Chưa có sản phẩm trong giỏ hàng/i)).toBeTruthy();

    // Input vẫn giữ nguyên "Ensure" để người dùng tiếp tục xem danh sách lọc
    expect(searchInput.value).toBe('Ensure');
  });

  it('Khi tìm mã không tồn tại, nhấn Enter không thêm vào giỏ và giữ nguyên input', async () => {
    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    const searchInput = screen.getByPlaceholderText('Tìm kiếm sản phẩm (mã, tên...)');

    // Mã không tồn tại
    fireEvent.change(searchInput, { target: { value: 'SP999' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    expect(screen.getByText(/Chưa có sản phẩm trong giỏ hàng/i)).toBeTruthy();
    expect(searchInput.value).toBe('SP999');
  });

  it('Khi sản phẩm hết hàng trong kho, nhấn Enter không thêm vào giỏ và giữ nguyên input', async () => {
    // Set 1 sản phẩm hết hàng trong kho trước khi render
    const products = JSON.parse(localStorage.getItem('minishop_products'));
    products[0].stockQuantity = 0;
    localStorage.setItem('minishop_products', JSON.stringify(products));

    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    const searchInput = screen.getByPlaceholderText('Tìm kiếm sản phẩm (mã, tên...)');

    fireEvent.change(searchInput, { target: { value: 'SP001' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    expect(screen.getByText(/Chưa có sản phẩm trong giỏ hàng/i)).toBeTruthy();
    expect(searchInput.value).toBe('SP001');
  });

  it('F1 và F2 focus vào search input mà KHÔNG xóa dữ liệu người dùng đang nhập dở', async () => {
    renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    const searchInput = screen.getByPlaceholderText('Tìm kiếm sản phẩm (mã, tên...)');

    // Người dùng gõ dở chữ
    fireEvent.change(searchInput, { target: { value: 'Ensure Gol' } });

    // Bấm F2
    fireEvent.keyDown(window, { key: 'F2', code: 'F2' });
    expect(searchInput.value).toBe('Ensure Gol');

    // Bấm F1
    fireEvent.keyDown(window, { key: 'F1', code: 'F1' });
    expect(searchInput.value).toBe('Ensure Gol');
  });

  it('Nhập mã liên tục SP001, SP002, SP003 đều được thêm đúng vào giỏ hàng mà không cần chuột', async () => {
    const { container } = renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    const searchInput = screen.getByPlaceholderText('Tìm kiếm sản phẩm (mã, tên...)');

    // Nhập SP001
    fireEvent.change(searchInput, { target: { value: 'SP001' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });
    expect(searchInput.value).toBe('');

    // Nhập SP002
    fireEvent.change(searchInput, { target: { value: 'SP002' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });
    expect(searchInput.value).toBe('');

    // Nhập SP003
    fireEvent.change(searchInput, { target: { value: 'SP003' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });
    expect(searchInput.value).toBe('');

    // Kiểm tra tổng số lượng món trong giỏ hàng là 3
    expect(screen.getByText('Tổng số lượng')).toBeTruthy();
    expect(container.querySelector('.summary-line-item .font-mono').textContent).toBe('3');
  });

  it('Không cho phép thêm vào giỏ vượt quá tồn kho khả dụng (stock = 2, cart = 2)', async () => {
    // Set stock của SP001 = 2
    const products = JSON.parse(localStorage.getItem('minishop_products'));
    products[0].stockQuantity = 2;
    localStorage.setItem('minishop_products', JSON.stringify(products));

    const { container } = renderSalesPage();

    expect(await screen.findByText('Bán hàng', {}, { timeout: 5000 })).toBeTruthy();

    const searchInput = screen.getByPlaceholderText('Tìm kiếm sản phẩm (mã, tên...)');

    // Lần 1: thêm thành công (cart = 1)
    fireEvent.change(searchInput, { target: { value: 'SP001' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    // Lần 2: thêm thành công (cart = 2)
    fireEvent.change(searchInput, { target: { value: 'SP001' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    // Lần 3: vượt quá tồn kho (cart = 2 = stock) -> Bị chặn
    fireEvent.change(searchInput, { target: { value: 'SP001' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    // Giữ nguyên input SP001 và số lượng tổng vẫn là 2
    expect(searchInput.value).toBe('SP001');
    expect(container.querySelector('.summary-line-item .font-mono').textContent).toBe('2');
  });
});






