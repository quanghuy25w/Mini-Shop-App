# 🛒 Mini-Shop - Hệ Thống Quản Lý Cửa Hàng & Tồn Kho

Ứng dụng web quản lý bán hàng, tồn kho và danh mục sản phẩm dành cho cửa hàng bán lẻ nhỏ, được phát triển bằng **React 19**, **Vite** và **JSON Server**.

---

## 📁 Cấu trúc thư mục dự án (Directory Structure)

```text
Mini-Shop/
├── public/                     # Tài nguyên tĩnh của ứng dụng
├── src/                        # Mã nguồn chính (React frontend)
│   ├── api/                    # Cấu hình & gọi API (Axios)
│   │   ├── axiosClient.js      # Base Axios instance (http://localhost:3001)
│   │   ├── categoryApi.js      # API danh mục sản phẩm
│   │   ├── inventoryApi.js     # API giao dịch nhập/xuất kho
│   │   ├── orderApi.js         # API đơn hàng bán hàng
│   │   └── productApi.js       # API sản phẩm
│   ├── assets/                 # Hình ảnh, font, icon
│   ├── components/             # React Components dùng chung & theo tính năng
│   │   ├── category/           # Modal & Form danh mục sản phẩm
│   │   ├── common/             # Layout, Header, Sidebar, ConfirmDialog, Spinner, EmptyState
│   │   ├── inventory/          # Form nhập/xuất kho
│   │   ├── product/            # Modal & Form quản lý sản phẩm
│   │   └── sales/              # Modal hóa đơn bán hàng
│   ├── context/                # React Context (AppDataContext lưu cache sản phẩm & danh mục)
│   │   └── AppDataContext.jsx
│   ├── hooks/                  # Custom Hooks xử lý nghiệp vụ
│   │   ├── useCart.js          # Logic giỏ hàng & tính tiền
│   │   ├── useCategories.js    # Logic CRUD danh mục
│   │   ├── useInventory.js     # Logic nhập kho & xuất kho (có rollback khi lỗi)
│   │   └── useProducts.js      # Logic CRUD sản phẩm
│   ├── pages/                  # Các trang (Screens) của ứng dụng
│   │   ├── CategoryPage.jsx    # Trang quản lý danh mục
│   │   ├── DashboardPage.jsx   # Trang tổng quan (Thống kê, tồn kho thấp, doanh thu)
│   │   ├── ExportPage.jsx      # Trang xuất kho thủ công
│   │   ├── ImportPage.jsx      # Trang nhập kho thủ công
│   │   ├── ProductPage.jsx     # Trang quản lý danh sách sản phẩm
│   │   ├── SalesPage.jsx       # Trang bán hàng (POS)
│   │   └── TransactionHistoryPage.jsx # Trang lịch sử giao dịch kho & đơn hàng
│   ├── routes/                 # Định tuyến ứng dụng (React Router v7)
│   │   └── AppRoutes.jsx
│   ├── styles/                 # CSS toàn cục & biến giao diện
│   │   └── global.css
│   ├── utils/                  # Các hàm tiện ích (Format tiền tệ, Validate, Export CSV, ID)
│   │   ├── exportCSV.js
│   │   ├── formatCurrency.js
│   │   ├── generateId.js
│   │   └── validate.js
│   ├── App.jsx                 # Component gốc
│   └── main.jsx                # Entry point chính
├── db.json                     # Cơ sở dữ liệu Mock (JSON Server)
├── index.html                  # HTML Template chính
├── package.json                # Định nghĩa dependencies & scripts
├── vite.config.js              # Cấu hình Vite
└── README.md                   # Tài liệu hướng dẫn dự án
```

---

## 🚀 Hướng dẫn cài đặt & Chạy ứng dụng

### 1. Yêu cầu tiền đề (Prerequisites)
- **Node.js**: phiên bản `>= 18.x`
- **npm**: phiên bản `>= 9.x`

### 2. Cài đặt các gói phụ thuộc (Dependencies)
Mở terminal tại thư mục gốc của dự án (`Mini-Shop`) và chạy lệnh:
```bash
npm install
```

### 3. Chạy ứng dụng

#### Cách 1: Chạy đồng thời cả Backend (JSON Server) & Frontend (Vite) *(Khuyên dùng)*
Chạy lệnh duy nhất để khởi động cả 2 server cùng lúc:
```bash
npm start
```
- **Frontend (Vite UI)**: `http://localhost:5173`
- **Backend (JSON Server API)**: `http://localhost:3001`

#### Cách 2: Chạy riêng từng service (trong 2 cửa sổ Terminal khác nhau)

1. **Khởi động Backend API Server (Port 3001)**:
   ```bash
   npm run server
   ```
   *Lưu ý: API server bắt buộc phải được chạy ở cổng `3001` để frontend kết nối đúng.*

2. **Khởi động Frontend Web App (Port 5173)**:
   ```bash
   npm run dev
   ```

---

## 🛠️ Danh sách Scripts trong `package.json`

| Script | Mô tả |
| :--- | :--- |
| `npm start` | Chạy đồng thời JSON Server (port 3001) và Vite Dev Server (port 5173) |
| `npm run server` | Khởi chạy JSON Server lắng nghe tại cổng `3001` với file `db.json` |
| `npm run dev` | Khởi chạy Vite Dev Server cho ứng dụng frontend |
| `npm run build` | Đóng gói ứng dụng cho môi trường production (`dist/`) |
| `npm run test` | Khởi chạy các unit test với Vitest |
| `npm run lint` | Kiểm tra lỗi cú pháp và format code bằng ESLint |

---

## 📡 Danh sách API Endpoints (`http://localhost:3001`)

- `GET /products`, `POST /products`, `PUT /products/:id`, `PATCH /products/:id`
- `GET /categories`, `POST /categories`, `PUT /categories/:id`, `DELETE /categories/:id`
- `GET /inventoryTransactions`, `POST /inventoryTransactions`, `DELETE /inventoryTransactions/:id`
- `GET /orders`, `POST /orders`, `PATCH /orders/:id`