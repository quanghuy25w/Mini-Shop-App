import { calculateTotalAmount } from '../utils/calculateTotal';
import { describe, it, expect } from 'vitest';

describe('Hàm calculateTotalAmount (Tính tổng tiền giao dịch kho)', () => {
  it('Tính đúng cho case (1, 4000) -> 4000', () => {
    expect(calculateTotalAmount(1, 4000)).toBe(4000);
  });

  it('Tính đúng cho case (4, 4000) -> 16000', () => {
    expect(calculateTotalAmount(4, 4000)).toBe(16000);
  });

  it('Tính đúng cho case (10, 4000) -> 40000', () => {
    expect(calculateTotalAmount(10, 4000)).toBe(40000);
  });

  it('Tính đúng cho case (4, 5000) -> 20000', () => {
    expect(calculateTotalAmount(4, 5000)).toBe(20000);
  });

  it('Tính đúng khi input là dạng chuỗi từ HTML form ("4", "4000") -> 16000', () => {
    expect(calculateTotalAmount('4', '4000')).toBe(16000);
  });

  it('Trả về 0 nếu số lượng hoặc đơn giá âm/không hợp lệ', () => {
    expect(calculateTotalAmount(-1, 4000)).toBe(0);
    expect(calculateTotalAmount(0, 4000)).toBe(0);
    expect(calculateTotalAmount('abc', 4000)).toBe(0);
  });
});
