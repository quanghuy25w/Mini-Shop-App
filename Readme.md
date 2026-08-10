#  MiniShop — E-Commerce App

Dự án thực hành xây dựng ứng dụng E-commerce bằng **ReactJS + Vite**, phát triển theo từng ngày với mục tiêu hoàn thiện dần từ cấu trúc đến tính năng thực tế.

---

## ✅ Ngày 1 — Hoàn thành

> Mục tiêu: Dựng project, cấu trúc thư mục chuẩn, routing cơ bản và mock layout cho toàn bộ các trang.

##  Cấu trúc thư mục

```
Mini-Shop/
├── public/
├── src/
│   ├── assets/
│   │
│   ├── components/          # UI components dùng chung
│   │   ├── Header.jsx       # Sticky navbar với NavLink active state
│   │   ├── Header.css
│   │   ├── Footer.jsx
│   │   └── Footer.css
│   │
│   ├── layouts/             # Bố cục trang
│   │   ├── MainLayout.jsx   # Header + <Outlet /> + Footer
│   │   └── MainLayout.css
│   │
│   ├── pages/               # Các trang của ứng dụng
│   │   ├── Home.jsx         # Hero 2 cột + Feature strip
│   │   ├── Products.jsx     # Grid 6 sản phẩm (ảnh Unsplash thật)
│   │   ├── ProductDetail.jsx# Chi tiết sản phẩm, dùng useParams()
│   │   ├── Cart.jsx         # Giỏ hàng + Order Summary panel
│   │   ├── NotFound.jsx     # Trang 404
│   │   └── Pages.css        # Shared styles cho tất cả pages
│   │
│   ├── routes/              # Cấu hình Router
│   │   └── AppRoutes.jsx    # Nested Routes config
│   │
│   ├── App.jsx              # Root component — chỉ render <AppRoutes />
│   ├── main.jsx             # Entry point — wrap <BrowserRouter>
│   └── index.css            # Global reset + Design tokens (CSS vars)
│
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

## Thư viện đã cài

| Package | Version | Mục đích |
|---|---|---|
| `react` | ^19 | Core UI framework |
| `react-dom` | ^19 | DOM rendering |
| `react-router-dom` | **v6** | Client-side routing |
| `lucide-react` | latest | Icon library |
| `vite` | ^8 | Build tool + Dev server |

---

## Chạy dự án

```bash
# Cài dependencies
npm install

# Chạy dev server
npm run dev

# Build production
npm run build
```
