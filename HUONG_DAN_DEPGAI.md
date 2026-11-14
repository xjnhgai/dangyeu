# ĐẹpGái — cập nhật luồng nhập và PIN, 14/11/2026

ZIP gồm toàn bộ mã nguồn hoàn chỉnh và bản build production, không kèm node_modules.

## Cập nhật dự án hiện có

1. Dừng dev server bằng Ctrl+C. Sao chép mã nguồn hiện tại sang thư mục dự phòng.
2. Mở thư mục `dangyeu` bên trong ZIP, chép toàn bộ nội dung vào thư mục gốc dự án cũ, nơi có `package.json`, rồi cho phép ghi đè.
3. Các dependency không đổi so với bản cập nhật trước. Nếu bạn đã chạy `npm.cmd ci` thành công cho bản trước, chạy:

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
npm.cmd run dev
```

Nếu đây là thư mục mới chưa có node_modules, chạy `npm.cmd ci` trước.
Nếu triển khai hosting, dùng nội dung dist vừa build trên đúng tên miền/đường dẫn cũ.
Giữ nguyên IndexedDB và dữ liệu website. Không xóa dữ liệu trình duyệt để cập nhật.

## Vừa xem A4 vừa nhập

- Mở A4 → Sửa, chọn nhóm tên và loại thiết lập.
- Chọn ô Liệt kê hoặc Điểm: cửa sổ Sửa được cất đi, thay bằng thanh nhập nhỏ phía trên bàn phím. A4 vẫn hiển thị, cuộn và thu phóng được.
- Số đang nhập được phản chiếu trên A4. Đây là bản xem nháp, chưa thêm vào bảng tính cho đến khi bấm Thêm/Lưu.
- Enter trong Liệt kê chuyển sang Điểm. Enter trong Điểm thực hiện Thêm hoặc Lưu.
- Sau khi thêm một dòng mới, thanh nhập vẫn mở và sẵn sàng cho danh sách tiếp theo. Sau khi lưu sửa một dòng cũ, quay lại cửa sổ Sửa.
- Nút × đóng thanh nhập; nội dung nháp vẫn được giữ theo cơ chế tự lưu. Nếu muốn áp dụng sửa một dòng cũ vào A4 chính thức, bấm Lưu hoặc Enter ở Điểm.
- Liệt kê chỉ giữ số, dấu phẩy và khoảng trắng; phím dấu chấm trên bàn phím số được chuyển thành dấu phẩy. Giữ nguyên số 0 đầu. Nội dung nhiều dòng vẫn được hỗ trợ khi dán.
- Khi đang xem nháp, tổng tính toán tạm ẩn để tránh trộn kết quả đã lưu với nội dung chưa xác nhận.
- Cỡ nhập là 20 px; không vô hiệu hóa khả năng zoom thủ công của người dùng. Cần xác nhận hành vi bàn phím trên điện thoại thực tế.

## Sắp xếp tên nhóm 2

Có hai cách:

1. Kéo trực tiếp trên các thẻ tên như bản trước.
2. Bấm nút quản lý tên nhóm (✎), giữ tay nắm sáu chấm ở bên trái tên rồi kéo lên/xuống, giống danh sách nhóm thiết lập.

Thứ tự được lưu và áp dụng trên các A4. Hủy thao tác kéo không thay đổi thứ tự. Không thay tên, ID hay chuyển các dòng dữ liệu sang nhóm khác.

## Hệ số mặc định

- Hệ số Đánh và Trúng mặc định đều bằng **1**.
- ĐA/ĐB: cả cấu hình 2 và 3 chữ số đều khởi tạo bằng 1.
- XA/XB: cả cấu hình 2, 3, 4 và 5 số đều khởi tạo bằng 1.
- Khi mở dữ liệu cũ, chỉ điền giá trị còn thiếu. Hệ số đã sửa, kể cả số 0, được giữ lại. Hệ số scalar cũ của ĐA/ĐB được giữ khi đọc bản ghi cũ chưa có snapshot profile.
- Cài đặt hệ số và Reset tên thiết lập yêu cầu PIN nhà phát hành riêng, được giải thích trong `HUONG_DAN_NHA_PHAT_HANH.md`.
- Đóng cửa sổ cài đặt hoặc chuyển nền sẽ khóa lại quyền sửa hệ số/Reset tên. Mở lại phải nhập PIN lại.

## PIN người dùng

- PIN gồm đúng 4 số, hiển thị rõ ký tự khi nhập, có thể bắt đầu bằng 0.
- Bật, đổi, tắt PIN trong Cài đặt → PIN. Đổi/tắt phải xác minh PIN hiện tại; PIN mở app của nhà phát hành cũng được chấp nhận.
- Mở lại hoặc chuyển nền thì app khóa nếu đang bật PIN người dùng.
- **Sai 3 lần liên tiếp sẽ tự xóa toàn bộ A4, các dòng thiết lập, kết quả và bản nháp.** Giữ danh sách tên nhóm 2 và catalog hệ số. Mã PIN người dùng vẫn được giữ; PIN nhà phát hành vẫn mở được app.
- Số lần sai được lưu qua lần tải lại. Nhập đúng PIN người dùng hoặc PIN mở app của nhà phát hành sẽ đặt bộ đếm về 0.
- Sai PIN riêng của cửa sổ cài hệ số không tính vào bộ đếm xóa dữ liệu của PIN người dùng.
- Quy tắc xóa áp dụng cả khi xác minh PIN hiện tại để đổi/tắt PIN. Chỉ gửi xác minh khi đã nhập đủ 4 số.
- Lần cập nhật từ bản cũ dùng quy tắc chờ sau 5 lần sai sẽ khởi tạo lại bộ đếm; không dùng các lần sai của bản cũ để xóa dữ liệu ngay khi cập nhật.
- Thao tác xóa chạy sau các lần tự lưu đã xếp hàng, bỏ editor cũ trước khi xóa và dọn các bản ghi legacy. Nếu bị gián đoạn, app hoàn tất việc dọn ở lần mở/kiểm tra tiếp theo trước khi hiển thị dữ liệu.

## Thời hạn lưu trữ và JPG

Giữ chức năng lưu trữ đã có: mặc định tự xóa tắt; khi bật, giữ số ngày đã chọn kể cả hôm nay, tính theo ngày trên A4. Có xác nhận số A4 hiện tại sẽ bị xóa trước khi áp dụng. PWA đã đóng không chạy lịch nền; dọn khi mở lại.

Bản xuất JPG tiếp tục có tổng Điểm/Đánh/Trúng, phép đo độ rộng đúng cho số 3 chữ số và nhiều ảnh khi A4 dài.

## Kiểm tra trên thiết bị

1. Dùng dữ liệu thử để mở Liệt kê, quan sát A4 còn nhìn được khi bàn phím hiện. Thử Enter/Next sang Điểm và Enter/Done để thêm.
2. Nhập nhiều dòng liên tục; kiểm tra A4 cập nhật bản xem và không bị tự phóng to vào ô nhập.
3. Kéo tên nhóm bằng tay nắm trong danh sách quản lý, tải lại và kiểm tra thứ tự.
4. Mở cài đặt hệ số, thử sai mã và đúng mã; kiểm tra đóng/mở lại đều yêu cầu xác minh.
5. Chỉ kiểm thử quy tắc sai PIN 3 lần trên bộ dữ liệu thử vì thao tác xóa là thật và không có chức năng hoàn tác trong app.
6. Kiểm tra ảnh xuất và chạy ngoại tuyến sau khi đã mở app online để Service Worker lưu tài nguyên.

Kiểm thử tự động dùng jsdom, Canvas giả lập và fake-indexeddb; không thay thế kiểm thử Safari/Chrome với bàn phím và PWA cài thật. Môi trường kiểm tra chưa khởi chạy được Chromium nên chưa có xác nhận hình ảnh trên điện thoại.

## Hàm và thành phần mới

| Hàm/thành phần | Hoạt động và tham số chính |
|---|---|
| `withCoefficientDefaults(type)` | Điền hệ số còn thiếu; bảo toàn hệ số đã sửa, bao gồm 0 và các giá trị ĐA/ĐB cũ. |
| `initializeCoefficientDefaults(data)` | Áp dụng mặc định cho catalog lúc đọc dữ liệu; không sửa các dòng A4 lịch sử. |
| `buildEntryPreview(data, target, row)` | Tạo cây hiển thị nháp từ đích A4/nhóm/loại/dòng và listing/point; không thay cây dữ liệu đã lưu. |
| `EntryDock` | Thanh nhập Liệt kê/Điểm trên A4. Các callback cập nhật bản nháp, thêm/lưu, đóng thanh nhập. `initialField` chọn ô nhận focus khi mở. |
| `PublisherPrompt` | Xác minh PIN cài đặt trước khi cấp quyền sửa hệ số và Reset tên. |
| `checkPin(preferences, pin)` | Xác minh PIN mở app; trả `ok`, `wipeRequired` và cài đặt mới. Không nhận tham số thời gian chờ như bản cũ. |
| `verifyAccess(pin)` | Điều phối xác minh, lưu số lần sai và xóa khi cần; dùng cho mở app và đổi/tắt PIN. |
| `wipeCalculationEntries(preferences)` | Xếp hàng sau autosave rồi ghi dữ liệu trống và cài đặt trong cùng giao dịch, giữ tên/hệ số/khóa và dọn bản ghi legacy. Nếu lỗi ghi, hủy toàn bộ giao dịch, giữ marker để thử lại. |

Không thay đổi quy tắc áp dụng hệ số cho lịch sử, không thêm chống nhiều tab hoặc sao lưu/khôi phục.
