# 🛒 Mini-Shop - Hệ Thống Quản Lý Bán Hàng & Tồn Kho

Ứng dụng web quản lý bán hàng (POS), tồn kho, ca làm việc và báo cáo kinh doanh dành cho cửa hàng bán lẻ, được xây dựng với hiệu năng cao, bảo đảm toàn vẹn dữ liệu bằng **React 19**, **Vite**, **React Router v7**, **JSON Server** và kiểm thử toàn diện với **Vitest**.

---

## 🎯 Chuẩn Nghiệp Vụ Cốt Lõi (Core Business Rules)

Hệ thống được thiết kế và chuẩn hóa theo bộ quy tắc nghiệp vụ thực tế cho mô hình bán lẻ 1 điểm bán, 1 quầy thu ngân:

1. **Mô hình 1 Ca làm việc / Ngày (Daily WorkSession)**:
   - Mỗi ngày làm việc có đúng 1 WorkSession (`shiftType: 'daily'`) kéo dài từ 07:30 đến 22:00.
   - Nhân sự chấm công theo 3 khung làm việc: **Sáng (07:30–12:00)**, **Chiều (13:00–18:30)**, **Tối (19:00–22:00)** với thời gian gia hạn (grace period) 5 phút.
   - Khung giờ nghỉ cố định (**12:00–13:00** và **18:30–19:00**): Vẫn cho phép bán hàng tại quầy và tự động gắn cờ `isRestPeriodSale: true`.
   - Kết toán đóng ca: So khớp tiền mặt trong két với số dư kỳ vọng ($\text{Expected Cash} = \text{Initial Cash} + \text{Cash Sales} - \text{Cash Cancels}$). Bắt buộc ghi chú giải trình nếu phát sinh chênh lệch thừa/thiếu.

2. **Ngày nghiệp vụ chuẩn Giờ Việt Nam (`businessDate`)**:
   - Sử dụng múi giờ `Asia/Ho_Chi_Minh` (UTC+7) cho toàn bộ chứng từ (đơn hàng, phiếu kho, ca trực, báo cáo).
   - Loại bỏ hoàn toàn việc cắt chuỗi ISO UTC (`createdAt.slice(0, 10)`), bảo đảm các đơn bán lúc tối muộn (20:00–22:00) không bị nhảy sang ngày hôm sau.

3. **Tồn kho & Giá vốn Bình quân Gia quyền (WAC - Weighted Average Cost)**:
   - Tồn kho chỉ thay đổi thông qua chứng từ kho có lý do rõ ràng: `OPENING` (tồn đầu kỳ), `PURCHASE` (nhập mua), `SALE` (bán hàng), `CANCEL_RESTOCK` (hoàn hủy đơn), `INTERNAL` (xuất nội bộ), `DAMAGE` (hư hỏng), `ADJUST` (kiểm kê).
   - Khi nhập mua (`PURCHASE`) hoặc tạo tồn đầu (`OPENING`), giá vốn sản phẩm được tự động tính lại theo công thức bình quân gia quyền:
     $$\text{costPrice}' = \frac{\text{stockQuantity} \times \text{costPrice} + \text{inQty} \times \text{inPrice}}{\text{stockQuantity} + \text{inQty}}$$
   - Hoàn hàng do hủy đơn (`CANCEL_RESTOCK`) ghi nhận phiếu kho theo giá vốn hiện tại và tuyệt đối không kéo sai giá vốn sản phẩm.

4. **Phân quyền trần 3 Cấp bậc (Strict Role Hierarchy)**:
   - **Admin (Quản trị viên)**: Toàn quyền hệ thống, quản lý tài khoản, phân quyền, xóa mềm sản phẩm/danh mục, hủy đơn mọi lúc.
   - **Staff (Quản lý cửa hàng)**: Quản lý sản phẩm/danh mục, nhập/xuất kho, bán hàng POS, hủy đơn trong ngày/ca còn mở, quản lý ca trực và xem báo cáo/audit log.
   - **Employee (Nhân viên thu ngân)**: Bán lẻ POS, xem danh sách sản phẩm/tồn kho, xem lịch sử đơn hàng cá nhân, chỉ được hủy đơn của chính mình trong vòng 15 phút thuộc ca đang mở.

---

## ✨ Tính năng chi tiết (Key Features)

### 1. 📦 Quản lý Sản phẩm (Product Management)
- **Mã SKU & Barcode**: SKU là trường định danh bắt buộc, duy nhất và bất biến sau khi đã phát sinh bán; hỗ trợ Barcode quét mã vạch.
- **CRUD & Khôi phục**: Thêm mới, chỉnh sửa, xóa mềm (`isActive = false`) và khôi phục sản phẩm (`reactivate`).
- **Tồn kho ban đầu an toàn**: Nhập tồn đầu kỳ khi tạo mới sản phẩm sẽ tự động sinh phiếu kho `OPENING` tương ứng.
- **Cảnh báo giá thông minh**: Cảnh báo khi giá bán $\le$ giá vốn, hiển thị biên lợi nhuận (%) theo thời gian thực.

### 2. 🗂️ Quản lý Danh mục (Category Management)
- **CRUD Danh mục**: Tạo và chỉnh sửa tên, mô tả danh mục.
- **Ràng buộc an toàn**: Chặn xóa danh mục nếu đang có sản phẩm thuộc danh mục còn hoạt động (`isActive = true`).
- **Thống kê số lượng**: Tự động hiển thị số lượng sản phẩm thuộc từng danh mục.

### 3. 💳 Bán hàng POS & Hóa đơn (Point of Sale)
- **Giao diện POS linh hoạt**: 2 chế độ hiển thị (**Lưới ảnh - Grid** hoặc **Danh sách - List**).
- **Tìm kiếm đa tiêu chuẩn**: Ưu tiên theo thứ tự **Barcode chính xác $\rightarrow$ SKU chính xác $\rightarrow$ Tên chính xác $\rightarrow$ Danh sách gợi ý**.
- **Trần chiết khấu theo Role**: Nhân viên tối đa 10%, Quản lý tối đa 20%, Admin không giới hạn.
- **Phương thức thanh toán & Tiền thối**: Hỗ trợ Tiền mặt (`cash`), Chuyển khoản (`transfer`), Thẻ (`card`). Tự động tính tiền thối khi khách thanh toán tiền mặt.
- **Hotkeys bán hàng nhanh**:
  - `F1`: Focus vào ô tìm kiếm sản phẩm.
  - `F2`: Chế độ sẵn sàng quét mã vạch.
  - `F5`: Lưu đơn tạm (Draft Order theo ngày làm việc).
  - `F9`: Mở popup xác nhận thanh toán đơn hàng.
  - `F11`: In hóa đơn bán hàng trực tiếp.

### 4. 🔄 Quản lý Tồn kho & Batch Rollback
- **Nhập / Xuất kho nhiều dòng**: Nhập/xuất nhiều sản phẩm cùng lúc trên một phiếu.
- **Cơ chế Rollback nguyên tử (Atomic Rollback)**: Nếu bất kỳ dòng sản phẩm nào gặp lỗi trong quá trình xử lý, hệ thống tự động hoàn tác toàn bộ giao dịch và hoàn lại tồn kho nguyên trạng.

### 5. 📜 Lịch sử Đơn hàng & Hủy đơn Atomic
- **Quy trình hủy đơn an toàn**: Hoàn kho + đổi trạng thái đơn `cancelled` + sinh phiếu `CANCEL_RESTOCK` trong một thao tác atomic.
- **Lọc & Phân quyền**: Nhân viên chỉ xem đơn của mình; Quản lý và Admin xem toàn bộ đơn trong hệ thống.

### 6. ⏱️ Quản lý Ca làm việc & Kết toán Quỹ
- **Theo dõi chấm công**: Ghi nhận trạng thái trực ca, vào muộn (vượt quá 5 phút grace period).
- **Kết toán quỹ tiền mặt**: Bảng tính đối soát thu/chi tiền mặt, nhập số tiền thực tế trong két và bắt buộc giải trình khi có chênh lệch.

### 7. 📊 Báo cáo Doanh thu & Bán lẻ
- Thống kê doanh thu theo ngày nghiệp vụ (`businessDate`), báo cáo 7 ngày gần nhất, top sản phẩm bán chạy theo sản lượng thực tế và đối soát tính nhất quán cuối ngày.

---

## 📁 Cấu trúc thư mục dự án (Directory Structure)

```text
Mini-Shop/
├── src/                            # Mã nguồn chính (React frontend)
│   ├── api/                        # Cấu hình & gọi API RESTful
│   │   ├── axiosClient.js          # Base Axios Client & logic nhận diện Demo Mode
│   │   ├── categoryApi.js          # API Danh mục sản phẩm (soft delete, validate)
│   │   ├── inventoryApi.js         # API Giao dịch kho (IN/OUT/ADJUST/VOID)
│   │   ├── localStorageAdapter.js  # Giả lập REST API lưu trữ localStorage
│   │   ├── orderApi.js             # API Đơn hàng, sinh mã HD-YYYYMMDD-XXXX, hủy đơn
│   │   ├── productApi.js           # API Sản phẩm, cập nhật tồn kho có kiểm soát
│   │   └── workSessionApi.js       # API Ca làm việc, chấm công, đóng ca quỹ
│   ├── components/                 # React Components theo module
│   │   ├── category/               # Modal thêm/sửa danh mục
│   │   ├── common/                 # Layout, Header, Sidebar, ConfirmDialog, Pagination, Spinner
│   │   ├── inventory/              # Form nhập/xuất kho
│   │   ├── product/                # Modal thêm/sửa sản phẩm (SKU, Barcode, Tồn đầu)
│   │   ├── sales/                  # Modal thanh toán, đơn tạm, in hóa đơn
│   │   └── workSession/            # Modal đóng ca, đối soát quỹ tiền mặt
│   ├── context/                    # React Contexts
│   │   ├── AppDataContext.jsx      # Global Cache Products & Categories
│   │   ├── AuthContext.jsx         # Quản lý phiên đăng nhập & phân quyền
│   │   ├── CartContext.jsx         # State giỏ hàng & thanh toán POS
│   │   └── WorkSessionContext.jsx  # Quản lý ca trực & chấm công
│   ├── hooks/                      # Custom Business Hooks
│   │   ├── useAuth.js              # Hook phân quyền & kiểm tra `can(permission)`
│   │   ├── useCart.js              # Hook giỏ hàng & thanh toán checkout
│   │   ├── useCategories.js        # Hook danh mục
│   │   ├── useInventory.js         # Hook nhập/xuất kho kèm batch rollback
│   │   └── useProducts.js          # Hook sản phẩm & khôi phục
│   ├── pages/                      # Các trang giao diện chính
│   │   ├── CategoryPage.jsx        # Quản lý danh mục
│   │   ├── DashboardPage.jsx       # Tổng quan kinh doanh & cảnh báo tồn kho
│   │   ├── ExportPage.jsx          # Xuất kho
│   │   ├── ImportPage.jsx          # Nhập kho
│   │   ├── ProductPage.jsx         # Quản lý sản phẩm
│   │   ├── SalesPage.jsx           # Bán hàng POS
│   │   ├── TransactionHistoryPage.jsx # Lịch sử giao dịch & hủy đơn
│   │   └── WorkSession/            # Quản lý ca làm việc
│   ├── routes/                     # Định tuyến và bảo vệ quyền route
│   │   └── AppRoutes.jsx           # PermissionRoute & ProtectedRoute
│   ├── tests/                      # Bộ kiểm thử tự động Vitest (40 test suites)
│   └── utils/                      # Tiện ích dùng chung
│       ├── businessDate.js         # Xử lý múi giờ VN (Asia/Ho_Chi_Minh)
│       ├── costing.js              # Tính giá vốn bình quân gia quyền
│       ├── permissions.js          # Bảng quyền và kiểm tra trần role
│       ├── shiftConfig.js          # Cấu hình ca làm việc, khung giờ & giờ nghỉ
│       ├── formatCurrency.js       # Định dạng tiền tệ VNĐ
│       └── printInvoice.js         # In hóa đơn bán lẻ
├── db.json                         # Database JSON Server mẫu
├── vite.config.js                  # Cấu hình Vite & Vitest
└── README.md                       # Tài liệu dự án
```

---

## 🚀 Hướng dẫn Cài đặt & Chạy ứng dụng

### 1. Yêu cầu hệ thống
- **Node.js**: Phiên bản `>= 18.x` (Khuyên dùng LTS 20.x hoặc 22.x)
- **npm**: Phiên bản `>= 9.x`

### 2. Cài đặt Dependencies
```bash
npm install
```

### 3. Khởi chạy ứng dụng

#### 🔹 Cách 1: Chạy đầy đủ cả Backend & Frontend *(Khuyên dùng trên môi trường dev)*
```bash
npm start
```
- **Frontend (Vite UI)**: `http://localhost:5173`
- **Backend (JSON Server)**: `http://localhost:3001`

#### 🔹 Cách 2: Chạy độc lập ở Chế độ Demo (Không cần cài Backend)
```bash
# Windows PowerShell
$env:VITE_DEMO_MODE="true"; npm run dev

# Linux / macOS / Git Bash
VITE_DEMO_MODE=true npm run dev
```

---

## 🧪 Kiểm thử Tự động (Automated Testing)

Chạy toàn bộ 40 test suites với 317 bài test tự động:

```bash
npm run test
```

### 📊 Thống kê Kiểm thử:
- **Tổng số Test Files**: `40` files
- **Tổng số Test Cases**: `317` tests (100% Passed)
- **Tốc độ thực thi**: ~16s trên Vitest v4.x

---

## 📦 Đóng gói Production (Build)

```bash
npm run build
```
Kết quả build được xuất ra thư mục `dist/` sẵn sàng triển khai trên bất kỳ dịch vụ hosting tĩnh nào (Vercel, Netlify, Cloudflare Pages, Nginx...).