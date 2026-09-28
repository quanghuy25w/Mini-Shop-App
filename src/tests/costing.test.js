import { describe, it, expect } from 'vitest';
import { calculateWeightedAverageCost } from '../utils/costing';

describe('Costing Utility Tests (Giá vốn bình quân gia quyền)', () => {
  it('Tính đúng giá vốn bình quân: tồn 10 giá 1000, nhập 10 giá 2000 -> 1500', () => {
    const result = calculateWeightedAverageCost(10, 1000, 10, 2000);
    expect(result).toBe(1500);
  });

  it('Tính đúng khi ban đầu tồn 0: nhập 10 giá 2000 -> 2000', () => {
    const result = calculateWeightedAverageCost(0, 0, 10, 2000);
    expect(result).toBe(2000);
  });

  it('Tính đúng khi nhập với giá khác nhau: tồn 5 giá 10000, nhập 15 giá 20000 -> 17500', () => {
    // (5 * 10000 + 15 * 20000) / 20 = (50000 + 300000) / 20 = 350000 / 20 = 17500
    const result = calculateWeightedAverageCost(5, 10000, 15, 20000);
    expect(result).toBe(17500);
  });

  it('Làm tròn số nguyên khi ra số thập phân', () => {
    // tồn 10 giá 1000, nhập 5 giá 1500 -> (10000 + 7500) / 15 = 17500 / 15 = 1166.666... -> 1167
    const result = calculateWeightedAverageCost(10, 1000, 5, 1500);
    expect(result).toBe(1167);
  });

  it('Xử lý an toàn khi số lượng nhập = 0', () => {
    const result = calculateWeightedAverageCost(10, 1000, 0, 2000);
    expect(result).toBe(1000);
  });

  it('Xử lý an toàn với tham số undefined/null/chuỗi', () => {
    expect(calculateWeightedAverageCost('10', '1000', '10', '2000')).toBe(1500);
    expect(calculateWeightedAverageCost(undefined, null, 10, 5000)).toBe(5000);
    expect(calculateWeightedAverageCost(0, 0, 0, 0)).toBe(0);
  });
});
