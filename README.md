# ĐẹpGái

Ứng dụng tính toán PWA, hỗ trợ ngoại tuyến.

Hướng dẫn cập nhật, PIN, thời hạn lưu trữ, thao tác nhập và kéo thả: xem [HUONG_DAN_DEPGAI.md](HUONG_DAN_DEPGAI.md).

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run lint
npm.cmd test
npm.cmd run dev
```

Bản ZIP gồm tệp nguồn đầy đủ và dist; không chứa node_modules. Giữ nguyên dữ liệu website và IndexedDB khi cập nhật.

Triển khai thay app trong repo hiện có: xem [CAP_NHAT_GITHUB.md](CAP_NHAT_GITHUB.md). Production/preview dùng `/dangyeu/`; dev dùng `/`.
