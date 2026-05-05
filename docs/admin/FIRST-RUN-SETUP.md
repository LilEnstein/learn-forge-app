# Lần đầu setup — Trở thành Admin

Hướng dẫn này dành cho người tự deploy LearnForge. Bạn cần thực hiện bước này để có quyền quản trị app.

---

## Hệ thống quyền hạn trong LearnForge

LearnForge có 3 loại tài khoản:

| Loại | Làm được gì |
|---|---|
| **User thường** | Học, upload tài liệu, dùng AI companion |
| **Admin** | Quản lý tất cả user, xem/xóa tài liệu, quản lý API key pool |
| **Super Admin** | Tất cả quyền Admin + không thể bị hạ cấp bởi admin khác |

Khi bạn tự deploy app, bạn cần đặt mình là **Admin** qua biến môi trường `ADMIN_EMAILS`.

---

## Cách đặt mình làm Admin

### Bước 1: Thêm email vào .env.local

Mở file `.env.local`, tìm dòng:
```env
ADMIN_EMAILS=""
```

Sửa thành:
```env
ADMIN_EMAILS="email-của-bạn@gmail.com"
```

Muốn nhiều admin:
```env
ADMIN_EMAILS="email1@gmail.com,email2@gmail.com"
```

> Email phân cách bằng dấu phẩy, không có dấu cách.

### Bước 2: Restart app

```bash
# Dừng server (Ctrl+C) rồi chạy lại
npm run dev
```

### Bước 3: Đăng nhập bằng email đó

Vào http://localhost:3000/login  
Đăng nhập bằng đúng email bạn vừa điền vào `ADMIN_EMAILS`.

### Bước 4: Kiểm tra quyền admin

Sau khi đăng nhập, bấm vào avatar góc dưới trái.  
Nếu thấy **"Admin Dashboard"** trong menu → **Thành công!**

Nếu không thấy:
- Kiểm tra email đăng nhập có đúng với email trong `ADMIN_EMAILS` không (phân biệt chữ hoa/thường)
- Đảm bảo đã restart app sau khi sửa `.env.local`
- Xem [TROUBLESHOOTING.md#loi-dang-nhap-auth](../setup/TROUBLESHOOTING.md#loi-dang-nhap-auth)

---

## Cơ chế hoạt động

Khi bạn đăng nhập, hệ thống tự động kiểm tra:
1. Email của bạn có trong `ADMIN_EMAILS` không?
2. Nếu có → tự động set `role = "admin"` trong database (idempotent — an toàn khi chạy nhiều lần)
3. Quyền admin được giữ nguyên kể cả khi bạn xóa email khỏi `ADMIN_EMAILS`, cho đến khi admin khác hạ cấp thủ công

---

## Deploy production

Thêm `ADMIN_EMAILS` vào Vercel Environment Variables:

1. Vào Vercel Dashboard → Project → **Settings → Environment Variables**
2. Thêm biến `ADMIN_EMAILS` với email của bạn
3. Redeploy: `vercel --prod`
4. Đăng nhập lại → quyền admin được cấp tự động

---

## Bước tiếp theo

Sau khi có quyền admin:
- [ADMIN-GUIDE.md](ADMIN-GUIDE.md) — xem toàn bộ quyền hạn
- [MANAGE-USERS.md](MANAGE-USERS.md) — thêm/thăng cấp user
- [MANAGE-KEYS.md](MANAGE-KEYS.md) — thêm API key cho cả hệ thống
