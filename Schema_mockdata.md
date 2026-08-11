# Tài Liệu Cấu Trúc Dữ Liệu (Database Schema)

Tài liệu này mô tả chi tiết cấu trúc các thực thể (Entities) và mối quan hệ (Relationships) được thiết kế cho dự án Mini Shop, phục vụ cho việc tạo Mock Data và tích hợp Backend sau này.

---

## I. Chi Tiết Các Thực Thể (Entities)

### 1. `Category` (Danh mục)
Lưu trữ thông tin phân loại sản phẩm.
| Thuộc tính | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | string | **PK** | Mã danh mục định danh duy nhất. |
| `name` | string | | Tên danh mục hiển thị. |
| `description` | string | | Mô tả chi tiết về danh mục. |
| `imageUrl` | string | | Đường dẫn ảnh đại diện của danh mục. |
| `createdAt` | string | | Thời gian tạo bản ghi. |

### 2. `Product` (Sản phẩm)
Lưu trữ thông tin chi tiết của hàng hóa hiển thị trên giao diện.
| Thuộc tính | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | string | **PK** | Mã sản phẩm định danh duy nhất. |
| `categoryId` | string | **FK** | Khóa ngoại liên kết tới bảng `Category`. |
| `sku` | string | | Mã vạch/Mã lưu kho nội bộ của sản phẩm. |
| `name` | string | | Tên sản phẩm hiển thị. |
| `price` | number | | Giá bán lẻ. |
| `importPrice` | number | | Giá nhập (giá vốn) để tính lợi nhuận. |
| `unit` | string | | Đơn vị tính (hộp, lốc, thùng...). |
| `imageUrl` | string | | Đường dẫn ảnh sản phẩm. |
| `description` | string | | Mô tả chi tiết sản phẩm. |
| `isFeatured` | boolean | | Cờ đánh dấu sản phẩm nổi bật. |
| `createdAt` | string | | Thời gian tạo bản ghi. |

### 3. `Inventory` (Tồn kho)
Quản lý trạng thái số lượng hàng hóa hiện có thực tế.
| Thuộc tính | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `productId` | string | **PK, FK** | Khóa chính đồng thời là khóa ngoại liên kết tới `Product`. |
| `stockQuantity` | number | | Số lượng tồn kho hiện tại. |
| `minimumStock` | number | | Ngưỡng cảnh báo sắp hết hàng. |
| `lastUpdated` | string | | Thời gian cập nhật biến động kho gần nhất. |

### 4. `InventoryTransaction` (Giao dịch kho)
Lưu vết lịch sử mọi hoạt động nhập/xuất kho để kiểm toán.
| Thuộc tính | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | string | **PK** | Mã giao dịch định danh duy nhất. |
| `productId` | string | **FK** | Khóa ngoại liên kết tới `Product`. |
| `type` | string | | Loại giao dịch: `IMPORT` (Nhập), `EXPORT` (Xuất), `SALE` (Bán). |
| `quantity` | number | | Số lượng biến động trong giao dịch. |
| `unitPrice` | number | | Đơn giá tại thời điểm giao dịch. |
| `createdAt` | string | | Thời gian phát sinh giao dịch. |
| `note` | string | | Ghi chú thêm cho giao dịch. |

### 5. `Order` (Đơn hàng)
Quản lý thông tin tổng quan của một phiên mua hàng.
| Thuộc tính | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | string | **PK** | Mã đơn hàng định danh duy nhất. |
| `totalAmount` | number | | Tổng giá trị của đơn hàng. |
| `createdAt` | string | | Thời gian tạo đơn. |
| `status` | string | | Trạng thái đơn hàng (Đang xử lý, Hoàn thành, Đã hủy). |

### 6. `OrderItem` (Chi tiết đơn hàng)
Quản lý từng mặt hàng cụ thể nằm bên trong một đơn hàng.
| Thuộc tính | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | string | **PK** | Mã dòng chi tiết định danh duy nhất. |
| `orderId` | string | **FK** | Khóa ngoại liên kết tới đơn hàng tổng `Order`. |
| `productId` | string | **FK** | Khóa ngoại liên kết tới sản phẩm `Product`. |
| `quantity` | number | | Số lượng sản phẩm khách mua. |
| `price` | number | | Đơn giá chốt tại thời điểm khách mua. |

---

## II. Mối Quan Hệ (Relationships)

Mô hình dữ liệu được thiết kế chặt chẽ với các liên kết (Foreign Keys) như sau:

*   **Category - Product (1:N):** `1` Danh mục có thể chứa `Nhiều` Sản phẩm.
*   **Product - Inventory (1:1):** `1` Sản phẩm quản lý `1` Bản ghi tồn kho duy nhất.
*   **Product - InventoryTransaction (1:N):** `1` Sản phẩm có thể có `Nhiều` Giao dịch nhập/xuất kho theo thời gian.
*   **Product - OrderItem (1:N):** `1` Sản phẩm có thể nằm trong `Nhiều` Chi tiết đơn hàng khác nhau.
*   **Order - OrderItem (1:N):** `1` Đơn hàng tổng thể bao gồm `Nhiều` Chi tiết mặt hàng bên trong.