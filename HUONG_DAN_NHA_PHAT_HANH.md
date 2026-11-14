# PIN nhà phát hành — ĐẹpGái

| Mục đích | PIN |
|---|---|
| Mở app dù PIN người dùng là gì; cũng dùng thay PIN hiện tại khi đổi/tắt PIN người dùng | **1495** |
| Mở cài đặt hệ số Đánh/Trúng và nút Reset tên thiết lập | **1945** |

Hai mã có mục đích độc lập. 1495 không mở cửa sổ hệ số; 1945 không phải PIN mở app chung (trừ khi người dùng tự đặt PIN cá nhân trùng 1945).
Các hằng số nằm trong `src/core/app-preferences.ts`: `PUBLISHER_APP_PIN` và `PUBLISHER_SETTINGS_PIN`.

PIN người dùng xác minh bằng hash PBKDF2-SHA256 có salt. Mã nhà phát hành cố định vẫn có trong JavaScript phía trình duyệt; đây là cơ chế khóa giao diện theo yêu cầu, không bảo vệ trước người có khả năng sửa mã hoặc can thiệp kho trình duyệt.

Sau 3 lần sai PIN người dùng, app xóa toàn bộ A4, kết quả và bản nháp. Danh sách tên nhóm, hệ số, PIN và cài đặt ứng dụng được giữ lại. PIN 1495 mở app sau đó nhưng không phục hồi dữ liệu đã xóa. Việc xóa là thao tác dữ liệu của app, không phải cam kết xóa an toàn ở cấp ổ đĩa.

Khi triển khai hosting, chỉ tải nội dung dist; tài liệu này dành cho người quản lý mã nguồn.
