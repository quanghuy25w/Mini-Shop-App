import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Pagination from '../components/common/Pagination';

describe('Pagination Component Tests', () => {
  it('Ẩn hoàn toàn nếu totalPages <= 1 hoặc totalItems === 0', () => {
    const { container: c1 } = render(
      <Pagination currentPage={1} totalItems={15} pageSize={20} onPageChange={() => {}} />
    );
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(
      <Pagination currentPage={1} totalItems={0} pageSize={20} onPageChange={() => {}} />
    );
    expect(c2.firstChild).toBeNull();

    const { container: c3 } = render(
      <Pagination currentPage={1} totalItems={20} pageSize={20} onPageChange={() => {}} />
    );
    expect(c3.firstChild).toBeNull();
  });

  it('Hiển thị đúng thông tin dải sản phẩm và danh sách trang khi totalPages > 1', () => {
    const handlePageChange = vi.fn();
    render(
      <Pagination
        currentPage={1}
        totalItems={64}
        pageSize={20}
        onPageChange={handlePageChange}
      />
    );

    expect(screen.getByText(/Hiển thị/i)).toBeTruthy();
    expect(screen.getByText('1 - 20')).toBeTruthy();
    expect(screen.getByText('64')).toBeTruthy();

    // With 64 items and pageSize 20 => 4 pages: 1, 2, 3, 4
    expect(screen.getByRole('button', { name: '1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '3' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '4' })).toBeTruthy();

    // Click page 2
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(handlePageChange).toHaveBeenCalledWith(2);

    // Prev button should be disabled on page 1
    const prevBtn = screen.getByTitle('Trang trước');
    expect(prevBtn.disabled).toBe(true);

    // Next button should be enabled
    const nextBtn = screen.getByTitle('Trang sau');
    expect(nextBtn.disabled).toBe(false);
    fireEvent.click(nextBtn);
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });

  it('Tính đúng startItem và endItem ở trang cuối cùng', () => {
    render(
      <Pagination
        currentPage={4}
        totalItems={64}
        pageSize={20}
        onPageChange={() => {}}
      />
    );

    expect(screen.getByText('61 - 64')).toBeTruthy();

    // Next button disabled on last page
    const nextBtn = screen.getByTitle('Trang sau');
    expect(nextBtn.disabled).toBe(true);
  });

  it('Hiển thị dấu "..." rút gọn khi có nhiều trang (> 7 trang)', () => {
    render(
      <Pagination
        currentPage={5}
        totalItems={200}
        pageSize={20}
        onPageChange={() => {}}
      />
    );

    // totalPages = 10, currentPage = 5 => 1 ... 4 5 6 ... 10
    const ellipsisElements = screen.getAllByText('...');
    expect(ellipsisElements.length).toBe(2);
    expect(screen.getByRole('button', { name: '1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '4' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '5' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '6' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '10' })).toBeTruthy();
  });
});
