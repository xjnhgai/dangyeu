# Sửa thanh nhập và trang giấy

- Bỏ chú thích bên cạnh nút × và dòng lỗi đỏ trong thanh nhập.
- Số vượt độ dài cho phép bị từ chối ngay bằng cửa sổ “Nhập sai số”. Số đang gõ dở được phép giữ tạm, nhưng không thể Thêm/Lưu khi chưa đúng độ dài. LB dùng số hai chữ số; DA/DB giữ quy tắc hai hoặc ba chữ số của thiết lập.
- Số trùng vẫn có cửa sổ xác nhận. Hủy xác nhận không ghi dữ liệu và giữ thanh nhập mở.
- Giảm cỡ chữ/số trên giấy và trong JPG còn 50% so với bản trước; không giảm cỡ chữ ô nhập để tránh zoom do bàn phím.
- Giới hạn phóng to ở mức vừa chiều rộng, bao gồm nút + và thao tác hai ngón. Cho phép thu nhỏ.
- Mở Liệt kê hoặc Điểm sẽ đưa giấy về vừa chiều rộng và đầu trang. Bỏ tự thu theo chiều cao còn lại khi bàn phím mở. Giấy bám phía trên vùng xem, không căn giữa theo chiều dọc khi trang cao hơn vùng xem.
- Giữ cuộn trong vùng giấy riêng, cố định vùng xem theo visual viewport để giảm việc trang bị đẩy khỏi màn hình khi focus.
- Điểm/Đánh/Trúng dùng chung cột số, đặt sát nhãn sau dấu hai chấm; JPG dùng chung vị trí số tương ứng.

Build, lint và 228 kiểm thử tự động đạt. Kiểm thử dùng DOM/Canvas/IndexedDB giả lập, chưa xác nhận bố cục và bàn phím trên iPhone thật.

Giải nén và chép nội dung thư mục dangyeu vào thư mục dự án chứa package.json, giữ nguyên .git. Không xóa dữ liệu trang web hoặc cài lại PWA để cập nhật. Sau đó chạy build/lint/test rồi commit và push lên main như trước.
