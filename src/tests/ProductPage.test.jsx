import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import ProductPage from '../pages/ProductPage';
import { AppDataProvider } from '../context/AppDataContext';
import { initSeedData } from '../api/localStorageAdapter';

const renderProductPage = () => {
  return render(
    <AppDataProvider>
      <BrowserRouter>
        <ProductPage />
      </BrowserRouter>
    </AppDataProvider>
  );
};

describe('Group 2: Sản phẩm (ProductPage) Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    initSeedData();
  });

  it('Hiện cảnh báo khi giá bán < giá vốn nhưng vẫn cho phép lưu sản phẩm', async () => {
    const { container } = renderProductPage();

    expect(await screen.findByText(/Quản lý sản phẩm/i, {}, { timeout: 5000 })).toBeTruthy();

    // Open Add Product modal
    fireEvent.click(screen.getByText('Thêm sản phẩm'));

    await waitFor(() => {
      expect(screen.getByText(/Thêm sản phẩm mới/i)).toBeTruthy();
    });

    // Fill form fields by name attribute
    const nameInput = container.querySelector('input[name="name"]');
    fireEvent.change(nameInput, { target: { value: 'Sản Phẩm Cảnh Báo Giá' } });

    const categorySelect = container.querySelector('select[name="categoryId"]');
    fireEvent.change(categorySelect, { target: { value: 'c1111111-1111-1111-1111-111111111111' } });

    const costInput = container.querySelector('input[name="costPrice"]');
    fireEvent.change(costInput, { target: { value: '50000' } });

    const sellInput = container.querySelector('input[name="sellPrice"]');
    fireEvent.change(sellInput, { target: { value: '30000' } });

    // Expect warning alert text
    expect(screen.getByText(/Cảnh báo: Giá bán đang nhỏ hơn hoặc bằng giá vốn!/i)).toBeTruthy();

    // Click Submit
    fireEvent.click(screen.getByText('Lưu'));

    // Expect saved product to appear in list
    await waitFor(() => {
      expect(screen.getByText('Sản Phẩm Cảnh Báo Giá')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('Xóa sản phẩm thực hiện xóa mềm (isActive = false, không xóa khỏi DB)', async () => {
    renderProductPage();

    expect(await screen.findByText(/Quản lý sản phẩm/i, {}, { timeout: 5000 })).toBeTruthy();

    // Click delete on first product e.g. "Abbott Ensure Gold 380g (Beta Glucan)"
    const deleteBtns = screen.getAllByTitle('Xóa');
    fireEvent.click(deleteBtns[0]);

    // Expect confirm dialog
    expect(screen.getByText('Xác nhận xóa')).toBeTruthy();

    // Confirm deletion
    fireEvent.click(screen.getByText('Đồng ý'));

    // Product should disappear from the active products list UI
    await waitFor(() => {
      expect(screen.queryByText('Abbott Ensure Gold 380g (Beta Glucan)')).toBeNull();
    }, { timeout: 5000 });

    // Check localStorage directly: item still exists in db but isActive === false
    const productsInStorage = JSON.parse(localStorage.getItem('minishop_products'));
    const testProd = productsInStorage.find(p => p.name === 'Abbott Ensure Gold 380g (Beta Glucan)');
    expect(testProd).toBeTruthy();
    expect(testProd.isActive).toBe(false);
  });

  it('Xuất báo cáo CSV dữ liệu đang hiển thị', async () => {
    renderProductPage();

    expect(await screen.findByText(/Quản lý sản phẩm/i, {}, { timeout: 5000 })).toBeTruthy();

    const csvBtn = screen.getByText('Xuất CSV');
    expect(csvBtn).toBeTruthy();
    fireEvent.click(csvBtn);
  });

  it('Phân trang hiển thị 20 sản phẩm/trang, tính đúng STT và chuyển trang thành công', async () => {
    renderProductPage();

    expect(await screen.findByText(/Quản lý sản phẩm/i, {}, { timeout: 5000 })).toBeTruthy();

    // Trang 1: có dải 1 - 20 và nút trang 1
    expect(screen.getByText('1 - 20')).toBeTruthy();
    expect(screen.getByRole('button', { name: '1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2' })).toBeTruthy();

    // Chuyển sang trang 2
    const page2Btn = screen.getByRole('button', { name: '2' });
    fireEvent.click(page2Btn);

    // Trang 2: STT bắt đầu từ 21 và dải 21 - 40
    await waitFor(() => {
      expect(screen.getByText('21')).toBeTruthy();
      expect(screen.getByText('21 - 40')).toBeTruthy();
    });

    // Khi tìm kiếm -> tự reset về trang 1
    const searchInput = screen.getByPlaceholderText('Tìm kiếm sản phẩm theo tên...');
    fireEvent.change(searchInput, { target: { value: 'Ensure' } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '1' })).toBeTruthy();
    });
  });

  it('Đồng bộ dữ liệu modal sửa sản phẩm: mở sửa SP A -> đóng -> mở sửa SP B không bị dính dữ liệu cũ', async () => {
    const { container } = renderProductPage();

    expect(await screen.findByText(/Quản lý sản phẩm/i, {}, { timeout: 10000 })).toBeTruthy();
    expect(await screen.findByText('Abbott Ensure Gold 380g (Beta Glucan)', {}, { timeout: 10000 })).toBeTruthy();

    const editBtns = await screen.findAllByTitle('Chỉnh sửa');

    // Mở sửa sản phẩm A (Abbott Ensure Gold)
    fireEvent.click(editBtns[0]);
    await waitFor(() => {
      const nameInput = container.querySelector('input[name="name"]');
      expect(nameInput?.value).toBe('Abbott Ensure Gold 380g (Beta Glucan)');
    });

    // Đóng modal
    fireEvent.click(screen.getByText('Hủy'));

    // Mở sửa sản phẩm B (Abbott Ensure Gold 800g)
    fireEvent.click(editBtns[1]);
    await waitFor(() => {
      const nameInputB = container.querySelector('input[name="name"]');
      expect(nameInputB?.value).toBe('Abbott Ensure Gold 800g (Beta Glucan)');
    });

    // Đóng và mở Thêm mới -> dữ liệu được reset
    fireEvent.click(screen.getByText('Hủy'));
    fireEvent.click(screen.getByText('Thêm sản phẩm'));
    await waitFor(() => {
      const nameInputNew = container.querySelector('input[name="name"]');
      expect(nameInputNew?.value).toBe('');
    });
  }, 15000);
});


