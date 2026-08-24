# 🛒 Mini-Shop - Hệ Thống Quản Lý Bán Hàng & Tồn Kho

Ứng dụng web quản lý bán hàng (POS), tồn kho và danh mục sản phẩm dành cho cửa hàng bán lẻ, được xây dựng với hiệu năng cao, trải nghiệm mượt mà bằng **React 19**, **Vite**, **React Router v7**, **JSON Server** và kiểm thử toàn diện với **Vitest**.

---

## ✨ Tính năng chính (Key Features)

### 1. 📦 Quản lý Sản phẩm (Product Management)
- **CRUD Sản phẩm**: Thêm mới, chỉnh sửa, xem danh sách và xóa sản phẩm.
- **Xóa mềm (Soft Delete)**: Đánh dấu `isActive = false`, giữ nguyên lịch sử giao dịch và đơn hàng cũ trong cơ sở dữ liệu.
- **Cảnh báo giá thông minh**: Tự động hiển thị cảnh báo trực quan khi giá bán $\le$ giá vốn, hiển thị tỷ suất biên lợi nhuận (%) theo thời gian thực.
- **Hình ảnh & Thumbnail**: Hỗ trợ hiển thị ảnh sản phẩm qua URL hoặc biểu tượng visual tương ứng theo từng danh mục.
- **Bộ lọc & Phân trang**: Tìm kiếm theo tên/mã sản phẩm, lọc theo danh mục, trạng thái tồn kho (*Còn hàng*, *Sắp hết*, *Hết hàng*), xuất báo cáo **CSV**, tự động quay về trang 1 khi lọc.

### 2. 🗂️ Quản lý Danh mục (Category Management)
- **CRUD Danh mục**: Tạo và chỉnh sửa tên, mô tả danh mục.
- **Chống trùng lặp**: Tự động kiểm tra và ngăn chặn tạo danh mục trùng tên (không phân biệt hoa/thường).
- **Ràng buộc toàn vẹn dữ liệu**: Chặn xóa danh mục nếu đang có sản phẩm thuộc danh mục đó còn hoạt động (`isActive = true`).
- **Thống kê số lượng**: Tự động đếm và hiển thị số lượng sản phẩm đang có trong từng danh mục.

### 3. 💳 Bán hàng POS & Hóa đơn (Point of Sale)
- **Giao diện POS trực quan**: Hỗ trợ 2 chế độ hiển thị linh hoạt (**Lưới sản phẩm - Grid** hoặc **Danh sách - List**).
- **Tìm kiếm & Quét mã vạch**: Tìm kiếm đa tiêu chuẩn ưu tiên theo Barcode $\rightarrow$ Mã SKU $\rightarrow$ Tên chính xác, bấm Enter hoặc dùng máy quét mã vạch để thêm nhanh vào giỏ.
- **Chiết khấu linh hoạt**: Hỗ trợ giảm giá theo **Phần trăm (%)** (tối đa 100%) hoặc theo **Số tiền mặt (₫)**.
- **Phím tắt bán hàng nhanh (Hotkeys)**:
  - `F1`: Focus nhanh vào ô tìm kiếm sản phẩm.
  - `F2`: Chế độ sẵn sàng quét mã vạch.
  - `F5`: Lưu đơn hàng tạm (Draft Order).
  - `F9`: Mở xác nhận thanh toán đơn hàng.
  - `F11`: In hóa đơn bán hàng trực tiếp.
- **Quản lý Đơn tạm (Draft Orders)**: Lưu nhiều đơn hàng đang xử lý dở dang, khôi phục vào giỏ hàng hoặc xóa đơn tạm bất kỳ lúc nào.
- **In hóa đơn**: Xuất hóa đơn bán hàng chuẩn cho máy in nhiệt/khổ giấy với đầy đủ thông tin cửa hàng, chiết khấu và danh sách món.

### 4. 🔄 Quản lý Tồn kho (Nhập / Xuất kho)
- **Nhập kho thủ công**: Tạo phiếu nhập nhiều sản phẩm cùng lúc, tự động tính tổng tiền nhập, cập nhật số lượng tồn kho và giá vốn.
- **Xuất kho thủ công**: Tạo phiếu xuất chuyển kho/tiêu hao, kiểm tra số lượng tồn kho tức thì (chặn xuất quá số lượng tồn hiện có).
- **Cơ chế Rollback an toàn**: Đảm bảo tính toàn vẹn dữ liệu — nếu có sự cố gián đoạn trong quá trình ghi nhận giao dịch nhiều sản phẩm, hệ thống tự động hoàn tác (rollback) lại trạng thái tồn kho ban đầu.

### 5. 📊 Dashboard & Thống kê (Dashboard & Analytics)
- **Chỉ số tổng quan (KPIs)**: Tổng số sản phẩm đang kinh doanh, tổng giá trị vốn tồn kho, doanh thu bán hàng 7 ngày gần nhất, tổng số đơn hoàn tất.
- **Xu hướng & Biến động**: Theo dõi sản phẩm mới thêm trong 24h, tỷ lệ tăng/giảm giá trị tồn kho trong 7 ngày.
- **Cảnh báo tồn kho thấp**: Danh sách các mặt hàng có tồn kho $\le$ ngưỡng cảnh báo (`minStockAlert`) hoặc hết hàng để kịp thời nhập thêm.
- **Top sản phẩm bán chạy**: Thống kê 5 sản phẩm có sản lượng và doanh thu cao nhất.

### 6. 📜 Lịch sử Giao dịch & Hủy đơn (Transaction History)
- **Lịch sử Giao dịch kho**: Theo dõi chi tiết mọi biến động nhập (`IN`) / xuất (`OUT`), lọc theo khoảng ngày, loại giao dịch, sản phẩm và xuất file CSV.
- **Lịch sử Đơn hàng bán**: Quản lý toàn bộ đơn hàng, xem chi tiết món, trạng thái đơn.
- **Hủy đơn & Hoàn kho tự động**: Hỗ trợ hủy đơn hàng đã hoàn tất; hệ thống tự động hoàn trả đúng số lượng sản phẩm vào kho và ghi nhận giao dịch nhập bù tương ứng.

### 7. 📱 Giao diện Responsive & Mobile Drawer
- Tương thích hoàn hảo trên mọi kích thước màn hình: Desktop, Laptop, Tablet và Mobile.
- Trên màn hình nhỏ ($\le 768\text{px}$): Sidebar tự động chuyển thành **Drawer trượt** tiện lợi với lớp nền làm mờ (Backdrop Blur Overlay), mở qua nút Hamburger trên Header và tự động đóng khi chọn trang hoặc bấm ra ngoài.

### 8. ⚡ Cơ chế Dữ liệu Kép (Dual-Mode Data Architecture)
- **Chế độ Thật (Real Mode - Localhost)**: Kết nối JSON Server qua REST API `http://localhost:3001` đọc/ghi vào file `db.json`.
- **Chế độ Demo Tự động (Demo Mode - Cloud/Storage)**: Khi chạy trên môi trường test (Vitest) hoặc triển khai lên các dịch vụ đám mây (Vercel, Netlify...) không có backend, ứng dụng tự động kích hoạt `localStorageAdapter.js` và nạp dữ liệu mẫu ban đầu từ `src/api/seedData.js`. Mọi thao tác đều được lưu vào `localStorage` của trình duyệt mà không cần cài đặt backend.

---

## 📁 Cấu trúc thư mục dự án (Directory Structure)

```text
Mini-Shop/
├── public/                         # Tài nguyên tĩnh của ứng dụng
├── src/                            # Mã nguồn chính (React frontend)
│   ├── api/                        # Cấu hình & gọi API (Axios & LocalStorage Adapter)
│   │   ├── axiosClient.js          # Base Axios Client & logic nhận diện Demo Mode
│   │   ├── categoryApi.js          # API CRUD danh mục sản phẩm
│   │   ├── inventoryApi.js         # API giao dịch nhập/xuất kho
│   │   ├── localStorageAdapter.js  # Adapter giả lập REST API lưu trữ trên localStorage
│   │   ├── orderApi.js             # API quản lý đơn hàng
│   │   ├── productApi.js           # API CRUD & xóa mềm sản phẩm
│   │   └── seedData.js             # Bộ dữ liệu mẫu chuẩn cho Demo Mode
│   ├── assets/                     # Hình ảnh, SVG, icon
│   ├── components/                 # React Components theo module
│   │   ├── category/               # Modal thêm/sửa danh mục (CategoryFormModal)
│   │   ├── common/                 # Layout, Header, Sidebar, ConfirmDialog, Pagination, Spinner, EmptyState
│   │   ├── inventory/              # Form nhập/xuất kho (StockForm)
│   │   ├── product/                # Modal thêm/sửa sản phẩm (ProductFormModal)
│   │   └── sales/                  # Modal xác nhận thanh toán, Đơn tạm, Hóa đơn (InvoiceModal)
│   ├── context/                    # React Contexts
│   │   ├── AppDataContext.jsx      # Global Cache cho Products & Categories
│   │   └── CartContext.jsx         # State giỏ hàng & tính toán POS
│   ├── hooks/                      # Custom Business Hooks
│   │   ├── useCart.js              # Nghiệp vụ giỏ hàng & thanh toán checkout kèm rollback
│   │   ├── useCategories.js        # Nghiệp vụ danh mục
│   │   ├── useInventory.js         # Nghiệp vụ nhập/xuất kho kèm rollback
│   │   └── useProducts.js          # Nghiệp vụ sản phẩm
│   ├── pages/                      # Các trang màn hình chính
│   │   ├── CategoryPage.jsx        # Quản lý danh mục
│   │   ├── DashboardPage.jsx       # Tổng quan thống kê & cảnh báo tồn kho
│   │   ├── ExportPage.jsx          # Xuất kho thủ công
│   │   ├── ImportPage.jsx          # Nhập kho thủ công
│   │   ├── ProductPage.jsx         # Quản lý sản phẩm & tồn kho
│   │   ├── SalesPage.jsx           # Bán hàng POS
│   │   └── TransactionHistoryPage.jsx # Lịch sử giao dịch kho & đơn hàng (Hủy đơn)
│   ├── routes/                     # Định tuyến ứng dụng
│   │   └── AppRoutes.jsx           # React Router v7 routes
│   ├── styles/                     # Định nghĩa Design Tokens & CSS toàn cục
│   │   └── theme.css               # Hallmark token system, màu sắc, font, media queries
│   ├── tests/                      # Bộ kiểm thử tự động Vitest
│   │   ├── CartContext.test.jsx
│   │   ├── CategoryPage.test.jsx
│   │   ├── DashboardPage.test.jsx
│   │   ├── ExportStockWorkflow.test.jsx
│   │   ├── FreshBrowser.test.jsx
│   │   ├── ImportStockWorkflow.test.jsx
│   │   ├── InventoryTransactions.test.jsx
│   │   ├── OrderCancelWorkflow.test.jsx
│   │   ├── Pagination.test.jsx
│   │   ├── ProductPage.test.jsx
│   │   ├── SalesPage.test.jsx
│   │   ├── StockCalculation.test.js
│   │   └── validateStock.test.js
│   ├── utils/                      # Hàm tiện ích dùng chung
│   │   ├── calculateTotal.js       # Tính toán tiền & tổng giá trị
│   │   ├── exportCSV.js            # Xuất dữ liệu ra file .csv
│   │   ├── formatCurrency.js       # Định dạng tiền tệ VND (₫)
│   │   ├── generateId.js           # Sinh mã định danh UUID v4
│   │   ├── printInvoice.js         # Tiện ích in hóa đơn ra cửa sổ in trình duyệt
│   │   └── validate.js             # Validation dữ liệu & kiểm tra số lượng tồn kho
│   ├── App.jsx                     # Component gốc ứng dụng
│   └── main.jsx                    # Entry point Vite
├── db.json                         # Cơ sở dữ liệu JSON Server mẫu
├── eslint.config.js                # Cấu hình ESLint 9 Flat Config
├── index.html                      # HTML Template
├── package.json                    # Khai báo Dependencies & Scripts
├── vite.config.js                  # Cấu hình Vite & Vitest
└── README.md                       # Tài liệu hướng dẫn dự án
```

---

## 🚀 Hướng dẫn Cài đặt & Chạy ứng dụng

### 1. Yêu cầu hệ thống (Prerequisites)
- **Node.js**: Phiên bản `>= 18.x` (Khuyên dùng Node LTS 20.x hoặc 22.x)
- **npm**: Phiên bản `>= 9.x`

### 2. Cài đặt Dependencies
Mở terminal tại thư mục gốc của dự án (`Mini-Shop`) và chạy:
```bash
npm install
```

### 3. Khởi chạy ứng dụng

#### 🔹 Cách 1: Chạy đầy đủ cả Backend & Frontend *(Khuyên dùng trên môi trường phát triển)*
Lệnh này sẽ tự động khởi động đồng thời cả JSON Server (port 3001) và Vite Dev Server (port 5173):
```bash
npm start
```
- **Giao diện người dùng (Frontend)**: `http://localhost:5173`
- **REST API Server (JSON Server)**: `http://localhost:3001`

#### 🔹 Cách 2: Chạy riêng biệt từng dịch vụ (2 cửa sổ Terminal)

1. **Terminal 1 - Khởi chạy Mock API Backend**:
   ```bash
   npm run server
   ```
   > ⚠️ **Lưu ý**: JSON Server bắt buộc phải lắng nghe tại cổng `3001` để frontend kết nối đồng bộ dữ liệu với file `db.json`.

2. **Terminal 2 - Khởi chạy Vite Dev Server**:
   ```bash
   npm run dev
   ```

#### 🔹 Cách 3: Chạy độc lập ở Chế độ Demo (Không cần Backend)
Nếu bạn muốn chạy ứng dụng độc lập trên môi trường local mà không cần khởi chạy JSON Server:
- **Tùy chọn A**: Tạo file `.env.local` tại thư mục gốc với nội dung:
  ```env
  VITE_DEMO_MODE=true
  ```
- **Tùy chọn B**: Chạy trực tiếp qua terminal:
  ```bash
  # Windows PowerShell
  $env:VITE_DEMO_MODE="true"; npm run dev

  # Linux / macOS / Git Bash
  VITE_DEMO_MODE=true npm run dev
  ```
> 💡 *Khi biến môi trường `VITE_DEMO_MODE=true` được bật (hoặc khi deploy lên domain cloud ngoài localhost), ứng dụng sẽ tự động kích hoạt `localStorageAdapter.js` để lưu trữ dữ liệu hoàn toàn trên trình duyệt.*

---

## 🛠️ Danh sách Lệnh Scripts trong `package.json`

| Lệnh | Công dụng |
| :--- | :--- |
| `npm start` | Chạy đồng thời JSON Server (cổng 3001) và Vite Dev Server (cổng 5173) bằng `concurrently` |
| `npm run dev` | Khởi chạy Vite Dev Server cho frontend (mặc định tại `http://localhost:5173`) |
| `npm run server` | Khởi chạy JSON Server lắng nghe tại cổng `3001` với cơ sở dữ liệu `db.json` |
| `npm run build` | Đóng gói toàn bộ ứng dụng phục vụ Production (`dist/`) |
| `npm run preview` | Chạy xem trước bản build production cục bộ |
| `npm run test` | Chạy toàn bộ bộ kiểm thử tự động với Vitest |
| `npm run lint` | Quét và kiểm tra lỗi cú pháp mã nguồn bằng ESLint |

---

## 🧪 Kiểm thử Tự động (Testing)

Dự án được xây dựng với hệ thống kiểm thử toàn diện bằng **Vitest** và **React Testing Library**:

```bash
npm run test
```

### 📊 Thống kê Kiểm thử Hiện tại:
- **Tổng số Test Files**: `13` files
- **Tổng số Test Cases**: `65` tests (100% Passed)

### 📋 Danh sách các nhóm nghiệp vụ được kiểm thử:
1. **POS & Bán hàng (`SalesPage.test.jsx`, `CartContext.test.jsx`)**: Giỏ hàng, kiểm tra giới hạn tồn kho, chiết khấu %, lưu đơn tạm, phím tắt và in hóa đơn.
2. **Quản lý Tồn kho (`ImportStockWorkflow.test.jsx`, `ExportStockWorkflow.test.jsx`)**: Nhập hàng, xuất hàng, kiểm tra tồn kho, cơ chế rollback khi lỗi.
3. **Hoàn trả & Hủy đơn (`OrderCancelWorkflow.test.jsx`, `InventoryTransactions.test.jsx`)**: Hủy đơn hàng và tự động bù lại tồn kho.
4. **Danh mục & Sản phẩm (`ProductPage.test.jsx`, `CategoryPage.test.jsx`)**: CRUD, xóa mềm `isActive`, cảnh báo giá bán $\le$ giá vốn, chặn xóa danh mục có sản phẩm, đồng bộ dữ liệu modal không bị dính dữ liệu cũ.
5. **Phân trang & Bộ lọc (`Pagination.test.jsx`)**: Tính toán số trang, logic thu gọn dấu 3 chấm (`...`), tự động về trang 1 khi lọc.
6. **Kiểm tra Demo Mode (`FreshBrowser.test.jsx`)**: Tự động khởi tạo dữ liệu mẫu khi truy cập lần đầu trên trình duyệt mới.
7. **Hàm tính toán & Validation (`StockCalculation.test.js`, `validateStock.test.js`)**: Kiểm tra logic tính tổng tiền, giá trị kho và xác thực số lượng.

---

## 📡 Danh sách API Endpoints (`http://localhost:3001`)

| Resource | Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- | :--- |
| **Products** | `GET` | `/products` | Lấy toàn bộ danh sách sản phẩm |
| | `POST` | `/products` | Thêm sản phẩm mới |
| | `PUT` | `/products/:id` | Cập nhật toàn bộ thông tin sản phẩm |
| | `PATCH` | `/products/:id` | Cập nhật một phần (VD: xóa mềm `isActive: false`, cập nhật tồn kho) |
| **Categories** | `GET` | `/categories` | Lấy danh sách danh mục |
| | `POST` | `/categories` | Tạo danh mục mới |
| | `PUT` | `/categories/:id` | Cập nhật danh mục |
| | `DELETE` | `/categories/:id` | Xóa danh mục |
| **Inventory** | `GET` | `/inventoryTransactions` | Lấy toàn bộ lịch sử giao dịch kho |
| | `POST` | `/inventoryTransactions` | Ghi nhận giao dịch nhập (`IN`) hoặc xuất (`OUT`) |
| | `DELETE` | `/inventoryTransactions/:id`| Xóa giao dịch kho (khi thực hiện rollback) |
| **Orders** | `GET` | `/orders` | Lấy danh sách đơn hàng đã thanh toán |
| | `POST` | `/orders` | Tạo đơn hàng mới |
| | `PATCH` | `/orders/:id` | Cập nhật trạng thái đơn hàng (VD: `status: "cancelled"`) |

---

## 🔧 Yêu cầu Hệ thống & Khắc phục Sự cố (Troubleshooting)

- **Cổng 3001 đã bị sử dụng**: Nếu gặp lỗi `Port 3001 is already in use`, hãy kiểm tra và tắt tiến trình đang chiếm cổng `3001` (hoặc đóng terminal JSON Server cũ) trước khi chạy `npm start`.
- **Dữ liệu trên Production Cloud**: Khi triển khai lên Vercel/Netlify, ứng dụng sẽ chạy độc lập trên `localStorage`. Để đặt lại dữ liệu mẫu ban đầu, người dùng chỉ cần xóa cache trình duyệt hoặc gọi hàm xóa `localStorage.clear()`.
- **Đồng bộ Schema Dữ liệu**: Khi thêm trường mới vào `Product`, `Order` hay `InventoryTransaction`, hãy cập nhật đồng bộ ở cả 2 nơi: file `db.json` và file `src/api/seedData.js`.

---

## 🌐 Demo

<!-- [Link Demo Trực Tuyến](https://your-demo-link.com) -->
*(Cập nhật link demo sau khi triển khai lên Vercel / Netlify / Cloud)*