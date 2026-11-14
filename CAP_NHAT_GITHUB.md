# Thay app đang chạy tại xjnhgai.github.io/dangyeu/

Bản này đã cấu hình production/preview tại `/dangyeu/`, dev tại `/`.
Cấu hình cũ trong repo trỏ `/xinhgai/`; bản cập nhật sửa base, manifest, icon và đường dẫn ảnh PIN.

1. Trong VS Code nhấn Ctrl+Shift+P → Git: Clone.
2. Nhập `https://github.com/xjnhgai/dangyeu.git`, chọn một thư mục mới rồi bấm Open khi clone xong. Nếu đã clone đúng repo, chỉ cần mở thư mục đó.
3. Mở thư mục `dangyeu` trong ZIP. Chép nội dung bên trong vào gốc repo vừa clone, nơi chứa package.json. Cho phép ghi đè; bao gồm `.github/workflows/deploy.yml`. Giữ nguyên `.git` của repo đã clone. Không chép node_modules hoặc ZIP vào repo.
4. Mở Terminal trong VS Code tại repo đã clone và chạy:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run lint
npm.cmd test
```

5. Nhấn Ctrl+Shift+G → bấm + cạnh Changes để Stage All → nhập `Cap nhat app DepGai` → Commit.
6. Chọn … → Push. Nhánh phải là main. Đăng nhập qua trình duyệt nếu VS Code yêu cầu. Đây là Push vào repo hiện có, không phải tạo kho mới bằng Publish to GitHub.
7. Trên GitHub vào tab Actions, chờ lần chạy mới của workflow `Deploy DepGai to GitHub Pages` hoàn tất màu xanh.
8. Mở `https://xjnhgai.github.io/dangyeu/`. Nếu app báo có bản mới, bấm Cập nhật ngay. Có thể tải lại trang trong trình duyệt để kiểm tra tên ĐẹpGái và icon mới.

Workflow vẫn dùng cùng các action được ghim SHA, Node 24, các bước cài/lint/test/build và quyền Pages như workflow hiện có trong repo. Chỉ sửa tên hiển thị. Bản ZIP đã có workflow này.

Lệnh dev vẫn mở tại `http://localhost:5173/`:

```powershell
npm.cmd run dev
```

Muốn xem build production trên máy bằng Vite Preview:

```powershell
npm.cmd run preview
```

Mở đường dẫn `/dangyeu/` trên cổng mà Preview hiển thị.

Không xóa dữ liệu website/IndexedDB để cập nhật. Dữ liệu từ localhost không tự chuyển sang tên miền GitHub Pages. App đã cài cũ với địa chỉ bắt đầu `/xinhgai/` có thể vẫn mở địa chỉ đó: hãy mở đúng link `/dangyeu/` trong trình duyệt và thêm PWA từ địa chỉ đúng nếu cần.

Repo đang Public theo ảnh. PIN nhà phát hành trong mã frontend có thể được xem bởi người đọc mã; các chức năng PIN không bảo vệ trước việc sửa mã phía máy khách.
