# Admin Guide — Toàn bộ quyền hạn Admin

Tài liệu tổng quan cho Admin và Super Admin của LearnForge.

---

## Truy cập Admin Dashboard

Sau khi đăng nhập với tài khoản admin:
- Bấm avatar góc dưới trái → **"Admin Dashboard"**
- Hoặc vào thẳng: `/admin`

---

## Tổng quan Admin Dashboard

```
Admin Dashboard
├── Overview        — Thống kê tổng: tổng user, tài liệu, khóa học, token dùng
├── Users           — Danh sách user, thăng/hạ cấp, đổi tier
├── Documents       — Xem tất cả tài liệu đã upload
├── API Keys        — Quản lý key pool dùng chung
└── System          — Cấu hình hệ thống, logs
```

---

## Quyền hạn theo role

| Tính năng | User | Admin |
|---|---|---|
| Học bài | ✅ | ✅ |
| Upload tài liệu | ✅ (giới hạn free tier) | ✅ (không giới hạn) |
| Xem tài liệu của mình | ✅ | ✅ |
| Xem tài liệu của người khác | ❌ | ✅ |
| Xóa tài liệu của người khác | ❌ | ✅ |
| Thăng cấp user lên admin | ❌ | ✅ |
| Hạ cấp admin khác | ❌ | ✅ |
| Thêm API key vào key pool | ❌ | ✅ |
| Xem system stats | ❌ | ✅ |
| Hạ cấp Super Admin | ❌ | ❌ (không ai được) |

---

## Quản lý User

Chi tiết: [MANAGE-USERS.md](MANAGE-USERS.md)

**Các tác vụ:**
- Xem danh sách toàn bộ user
- Thăng cấp user lên admin
- Hạ cấp admin về user thường
- Đổi tier (Free → Pro)
- Xóa tài khoản

---

## Quản lý API Key Pool

Chi tiết: [MANAGE-KEYS.md](MANAGE-KEYS.md)

Key pool là các API key admin cấp để user dùng mà không cần tự cung cấp key. Khi user không có key riêng, hệ thống dùng key từ pool.

**Các tác vụ:**
- Thêm API key vào pool
- Xem trạng thái từng key (active / quota exceeded)
- Xóa key hết hạn
- Phân bổ key theo tier user

---

## Tier System

| Tier | Giới hạn tài liệu | Dùng key pool | Unlimited hearts |
|---|---|---|---|
| Free | 3 tài liệu | Nếu admin cung cấp | ❌ |
| Pro | Không giới hạn | Ưu tiên cao hơn | ✅ |

Đổi tier user: Admin Dashboard → Users → click user → "Change Tier".

---

## Xem Logs và Stats

**Overview tab:**
- Total users, documents, courses
- API token usage (tổng và theo ngày)
- Ingestion queue status (số job đang xử lý)

**Tìm user cụ thể:**
Admin Dashboard → Users → dùng thanh search.

---

## Cấu hình hệ thống (System tab)

- Đổi giới hạn tài liệu free tier
- Bật/tắt đăng ký mới
- Xem version và migration status
