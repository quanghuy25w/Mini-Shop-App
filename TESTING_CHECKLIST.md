# KẾCH BẢN KIỂM THỬ (TESTING CHECKLIST) - MINI SHOP

Dưới đây là các bước kiểm thử thủ công theo luồng nghiệp vụ. 
Bạn hãy thực hiện lần lượt các bước này trên UI và đánh dấu vào cột kết quả.

| Luồng | Hành động | Kết quả mong đợi | Đạt/Không đạt |
|---|---|---|---|
| **1. Danh mục** | Trống Tên danh mục khi tạo mới | Form báo lỗi không được bỏ trống | [ ] |
| | Tạo danh mục trùng tên (chữ hoa/thường) | Form báo lỗi danh mục đã tồn tại | [ ] |
| | Xóa danh mục ĐANG CÓ sản phẩm active | Bật ConfirmDialog chặn xóa, hiển thị số SP đang dùng | [ ] |
| | Xóa danh mục KHÔNG CÓ sản phẩm active | Cho phép xóa thành công | [ ] |
| **2. Sản phẩm** | Tạo sản phẩm: Nhập giá bán < giá vốn | Hiện alert cảnh báo vàng nhưng vẫn cho lưu | [ ] |
| | Xóa sản phẩm | Xóa mềm thành công (vẫn còn trong db.json với isActive = false) | [ ] |
| | Bấm "Xuất báo cáo CSV" | Trình duyệt tải xuống file bao gồm đúng các SP đang hiển thị | [ ] |
| **3. Nhập/Xuất kho** | Vào trang Nhập kho, chọn sản phẩm | Số lượng tồn kho hiện tại được hiển thị đúng bên phải | [ ] |
| | Nhập số lượng 0 hoặc số âm | Cảnh báo HTML5 chặn không cho submit form | [ ] |
| | Nhập kho thành công 10 SP A | Form clear, Toast báo thành công, Tồn kho SP A bên phải +10 ngay lập tức | [ ] |
| | Vào trang Xuất kho, nhập SL xuất > Tồn kho | Chặn không cho gọi API, Toast/Text báo lỗi "vượt quá tồn kho" | [ ] |
| | Xuất kho thành công 5 SP A | Toast báo thành công, Tồn kho SP A bên phải -5 ngay lập tức | [ ] |
| **4. Bán hàng** | Vào trang Bán hàng, tìm sản phẩm A | Ô Search lọc ra SP A tức thì (có debounce) | [ ] |
| | SP B có tồn kho = 0 | Bị mờ, đè chữ "Hết hàng" và không click thêm vào giỏ được | [ ] |
| | Thêm SP A vào giỏ, sửa số lượng > Tồn kho | Báo lỗi Toast đỏ "Chỉ còn X sản phẩm", số lượng trong giỏ không tăng | [ ] |
| | Thêm nhiều SP, sửa số lượng, xóa SP khỏi giỏ | Cột Thành tiền từng dòng và Tổng thanh toán nhảy số đúng tuyệt đối | [ ] |
| | Bấm "Thanh toán" | Hiện Loading, sau đó hiển thị Modal Hóa đơn thành công | [ ] |
| | Sau khi thanh toán, đóng Modal | Giỏ hàng trống rỗng, Tồn kho của các SP ở cột trái bị trừ tương ứng ngay | [ ] |
| **5. Hủy đơn** | Vào Lịch sử GD -> Hóa đơn bán hàng | Danh sách HĐ hiện ra, sắp xếp HĐ vừa bán lên đầu | [ ] |
| | Bấm "Hủy đơn" cho HĐ vừa tạo -> Đồng ý | Trạng thái chuyển thành "Đã hủy", mất nút Hủy đơn | [ ] |
| | Quay lại trang Sản phẩm kiểm tra | Tồn kho của các SP trong HĐ đó được cộng lại như cũ | [ ] |
| **6. Giao dịch kho** | Vào Lịch sử GD -> Tab Giao dịch kho | Phiếu Nhập, Xuất, và cả phiếu IN từ việc "Hủy đơn" xuất hiện ở đầu bảng | [ ] |
| | Dùng bộ lọc (Tìm SP, Từ ngày - Đến ngày) | Bảng chỉ hiện đúng các record khớp tiêu chí | [ ] |
| | Bấm "Xuất báo cáo CSV" khi đang Filter | File tải về chỉ chứa các record ĐANG HIỆN trên bảng | [ ] |
| **7. Dashboard** | Mở màn hình Dashboard | Đang hiển thị đủ tổng SP Active, Doanh thu, Tổng giá trị tồn | [ ] |
| | Kiểm tra Bảng sắp hết hàng | Chỉ hiện các SP có Tồn <= minStockAlert và Tồn > 0 | [ ] |

---
*Ghi chú: Nếu phát hiện bất kỳ bước nào Không Đạt, hãy kiểm tra lại log API json-server hoặc Console trình duyệt.*
