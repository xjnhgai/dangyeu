# Trang giấy theo màn hình điện thoại — 15/11/2026

- Trang xem trong app lấy chiều rộng điện thoại, không còn ép khổ ISO A4 210 × 297 mm rồi thu nhỏ toàn bộ chữ. Chiều cao tăng theo nội dung, với chiều cao tối thiểu theo màn hình lúc mở trang.
- Đã bỏ nút vừa toàn trang ở góc trên bên phải điện thoại. Giữ thao tác thu phóng bằng hai ngón.
- Khi mở Liệt kê hoặc Điểm, đưa giấy về vừa chiều rộng và cuộn lên đầu. Có thể thu nhỏ bằng hai ngón; mức phóng to tối đa là vừa chiều rộng. Không tự thu giấy theo chiều cao bàn phím.
- Ô kết quả 1–7 chỉ giữ chữ số và dấu phân cách. Dùng ô nhiều dòng để dán kết quả không bị mất dấu xuống dòng và nối nhầm các số. Số 0 đầu vẫn được giữ; số lượng hợp lệ vẫn là 26.
- Tăng khoảng trống từ số Liệt kê tới đường kẻ dọc thành một dấu cách. Dịch cột giá trị Điểm/Đánh/Trúng gần dấu hai chấm hơn một dấu cách, vẫn dùng chung vị trí bắt đầu để thẳng hàng.
- Điều chỉnh khoảng cách tương ứng trong JPG. Tệp JPG tiếp tục xuất theo khổ A4 như trước; thay đổi khổ ở đây dành cho trang xem trên màn hình.

Cập nhật vào repo hiện có bằng cách chép nội dung dangyeu trong ZIP vào thư mục chứa package.json, giữ nguyên .git. Chạy npm.cmd run build, npm.cmd run lint, npm.cmd test; rồi Commit/Push vào main. Giữ nguyên dữ liệu trình duyệt.

Đã kiểm tra: build, lint và 228/228 kiểm thử. Kiểm tra mới bao gồm chiều rộng giấy 390 px, bỏ nút góc phải, khôi phục fit khi mở Liệt kê và lọc chữ trong kết quả 1–7. DOM giả lập chưa xác nhận được bố cục/bàn phím và cử chỉ trên điện thoại thật; cần kiểm tra lại trên thiết bị.
