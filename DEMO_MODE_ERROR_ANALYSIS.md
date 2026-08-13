# BÁO CÁO PHÂN TÍCH LỖI DỮ LIỆU & KIẾN TRÚC DEMO MODE (MINI-SHOP)

---

## 1. TÓM TẮT LỖI NGHIỆM TRỌNG

Trong quá trình phát triển dự án **Mini-Shop**, ứng dụng gặp phải sự cố dữ liệu theo kịch bản sau:

- **Khi chạy `npm start` trên máy cá nhân**: Ứng dụng triển khai trên Vercel mở trên chính máy đó thì lấy và hiển thị được dữ liệu.
- **Khi TẮT `npm start`**: Ứng dụng trên Vercel không hiển thị dữ liệu mẫu, không lưu được dữ liệu mới, hoặc báo lỗi kết nối.
- **Khi người dùng khác / trình duyệt mới mở Vercel**: Trang web trắng dữ liệu hoặc báo lỗi kết nối.

---

## 2. PHÂN TÍCH KIẾN TRÚC 2 CHẾ ĐỘ (DUAL ARCHITECTURE)

Dự án Mini-Shop được thiết kế với 2 chế độ hoạt động song song:

### 🔹 CHẾ ĐỘ 1: Local Development (Mode 1)
- **Mục đích**: Phục vụ lập trình viên phát triển và kiểm thử trên máy cá nhân.
- **Luồng dữ liệu**:
  $$\text{Trình duyệt (Browser)} \longrightarrow \text{React/Vite} \longrightarrow \text{axiosClient} \longrightarrow \text{http://localhost:3001} \longrightarrow \text{json-server} \longrightarrow \text{db.json}$$
- **Đặc điểm**: Dữ liệu lưu bền vững vào file `db.json` trên ổ đĩa thông qua REST API server (`json-server` port 3001).

---

### 🔹 CHẾ ĐỘ 2: Vercel Demo Mode (Mode 2)
- **Mục đích**: Phục vụ trải nghiệm Demo độc lập hoàn toàn trên đám mây (Vercel Cloud).
- **Luồng dữ liệu**:
  $$\text{Trình duyệt (Browser)} \longrightarrow \text{React/Vite} \longrightarrow \text{axiosClient} \longrightarrow \text{localStorageAdapter} \longrightarrow \text{localStorage trình duyệt}$$
- **Đặc điểm**: Dữ liệu nạp từ `seedData.js` khi lần đầu truy cập và được lưu độc lập trong `localStorage` của trình duyệt người dùng. Không cần bất kỳ backend server hay database nào.

---

## 3. NGUYÊN NHÂN GỐC TẠI SAO LẠI BỊ LỖI "TẮT npm start LÀ MẤT DỮ LIỆU"

### Nguyên nhân 1: Cơ chế Tree-Shaking của Vite / Rollup Bundler
Trong mã nguồn cũ của `src/api/axiosClient.js`, logic phát hiện Demo Mode chỉ dựa vào duy nhất biến môi trường `VITE_DEMO_MODE`:

```javascript
export const checkDemoMode = () => {
  if (import.meta.env.VITE_DEMO_MODE === 'true') {
    return true;
  }
  return false;
};
```

Khi tiến hành đóng gói sản xuất (`vite build`) trên Vercel mà không truyền trực tiếp biến môi trường này trong lệnh build tĩnh, trình biên dịch Vite/Esbuild đánh giá `checkDemoMode()` thành hằng số `false` tại thời điểm biên dịch (Compile-time Constant Folding).

**Hậu quả**:
1. Vite/Rollup tự động loại bỏ nhánh code `if (checkDemoMode())` (Dead Code Elimination).
2. Module `localStorageAdapter.js` và file dữ liệu mẫu `seedData.js` bị Rollup coi là "mã nguồn không được sử dụng" và **XÓA SẠCH HOÀN TOÀN** khỏi file JavaScript sản xuất (`dist/assets/index-*.js`).
3. Bản build thực tế đẩy lên Vercel chỉ còn chứa duy nhất mã gọi HTTP về `http://localhost:3001`.

---

### Nguyên nhân 2: Hiện tượng "Giả lập thành công" khi mở trên máy Developer
- Khi bạn chạy `npm start` trên máy developer, server `json-server` mở tại `http://localhost:3001`.
- Khi bạn dùng trình duyệt trên máy đó mở trang Vercel (`https://mini-shop-app-gx1n.vercel.app`), trình duyệt gửi HTTP Request tới `http://localhost:3001` (chính máy bạn) và nhận về dữ liệu từ `db.json` thành công. Điều này tạo cảm giác ứng dụng trên Vercel đã chạy đúng.
- Tuy nhiên, khi bạn **TẮT `npm start`** hoặc khi **NGƯỜI KHÁC** mở link Vercel trên máy của họ:
  - Máy của họ không có server nào chạy ở port 3001.
  - Trình duyệt báo lỗi kết nối `NET::ERR_CONNECTION_REFUSED`.
  - Do `localStorageAdapter.js` đã bị Vite xóa khỏi bundle, ứng dụng không thể nạp `seedData.js` hay lưu vào `localStorage`, dẫn đến mất hoàn toàn dữ liệu.

---

## 4. GIẢI PHÁP ĐÃ XỬ LÝ TRIỆT ĐỂ

Để ứng dụng Vercel hoạt động độc lập 100% không phụ thuộc vào `npm start`, các điều chỉnh sau đã được thực hiện:

1. **Phát hiện môi trường Cloud tự động tại Runtime**:
   Hàm `checkDemoMode()` kiểm tra tên miền truy cập `window.location.hostname`. Nếu ứng dụng chạy trên tên miền Cloud không phải `localhost` hay `127.0.0.1` (như `mini-shop-app-gx1n.vercel.app`), hệ thống tự động kích hoạt Demo Mode.

2. **Ngăn chặn Tree-Shaking dữ liệu mẫu**:
   Khởi tạo `initSeedData()` trực tiếp trong cây ứng dụng React (`AppDataContext.jsx`), buộc trình biên dịch Vite phải giữ lại toàn bộ `localStorageAdapter.js` và `seedData.js` trong file JavaScript bundle sản xuất.

3. **Cơ chế Seed Data an toàn**:
   - Khi trình duyệt mới mở Vercel lần đầu (`localStorage` rỗng) -> Khởi tạo ngay 4 mảng dữ liệu mẫu (`categories`, `products`, `inventoryTransactions`, `orders`).
   - Khi người dùng thêm/sửa/xóa/bán hàng và nhấn `F5` -> Dữ liệu mới lưu trong `localStorage` được giữ nguyên, không bị reset.

---

## 5. KẾT LUẬN

Dự án hiện tại đã đạt trạng thái độc lập hoàn toàn:
- **Local Mode**: Chạy `npm start` kết nối `json-server` (`db.json`) port 3001.
- **Vercel Demo Mode**: Tắt hoàn toàn `npm start`, mở trên trình duyệt bất kỳ/Incognito vẫn tự động có dữ liệu mẫu, cho phép thao tác CRUD, tính tiền chính xác và duy trì dữ liệu khi F5.
