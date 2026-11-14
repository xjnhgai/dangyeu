# Sửa giao diện iPhone và nhập liệu

- Theo dõi visualViewport ngay từ màn hình PIN, căn theo chiều cao/vị trí vùng nhìn thấy; giới hạn chiều cao thẻ để không bị cắt trên và khoảng trắng lớn.
- Bỏ nút mở khóa. Đủ 4 số sẽ tự duyệt một lần; khóa nhập trong khi đang xác minh.
- PIN 1945 mở được app và cài hệ số. PIN 1495 vẫn mở app để tương thích bản trước.
- Ẩn cảnh báo sai 3 lần khỏi giao diện. Quy tắc xóa sau 3 lần sai vẫn đang hoạt động; thử sai PIN bằng dữ liệu thử.
- LB nhận từng số đúng 2 chữ số (00–99). Dấu phẩy, khoảng trắng hoặc xuống dòng phân cách các số. Lỗi chỉ rõ mục, giá trị, số ký tự và ví dụ sửa.
- Enter trong Liệt kê xuống dòng, không tự chuyển sang Điểm. Chạm ô Điểm để nhập; Enter ở Điểm vẫn thêm/lưu.
- Khi mở trường sửa, con trỏ được đặt cuối chuỗi. Điều chỉnh thanh nhập theo vị trí visualViewport khi chạm Điểm.
- Các nút tên thiết lập có thể kéo thả trực tiếp, kể cả danh sách tràn; thứ tự lưu lại.

Cập nhật: chép nội dung dangyeu vào repo đang chứa package.json, giữ .git. Chạy npm.cmd run build, npm.cmd run lint, npm.cmd test. Sau đó git add ., git commit và git push origin main.

Build và lint đạt; 225/225 kiểm thử đạt. Chưa xác nhận bố cục thực trên Safari/iPhone; kiểm thử DOM không mô phỏng được việc bàn phím hệ điều hành đẩy viewport.
