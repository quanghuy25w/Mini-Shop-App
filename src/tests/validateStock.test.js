import { validateStock } from '../utils/validate';
import { describe, it, expect } from 'vitest';

describe('Hàm validateStock', () => {
  it('Báo lỗi nếu số lượng âm', () => {
    expect(validateStock(-5, 10)).toBe("Số lượng phải lớn hơn 0");
  });
  
  it('Báo lỗi nếu số lượng bằng 0', () => {
    expect(validateStock(0, 10)).toBe("Số lượng phải lớn hơn 0");
  });
  
  it('Hợp lệ (return null) nếu số lượng dưới tồn kho (nhỏ hơn)', () => {
    expect(validateStock(5, 10)).toBeNull();
  });
  
  it('Hợp lệ (return null) nếu số lượng đúng bằng tồn kho', () => {
    expect(validateStock(10, 10)).toBeNull();
  });
  
  it('Báo lỗi nếu số lượng vượt quá tồn kho', () => {
    expect(validateStock(11, 10)).toContain("Không thể xuất 11 sản phẩm");
  });
});
