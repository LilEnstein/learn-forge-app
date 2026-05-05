# Quản lý User

Hướng dẫn từng bước quản lý user trong Admin Dashboard.

---

## Xem danh sách user

1. Vào Admin Dashboard → tab **"Users"**
2. Thấy bảng với: tên, email, role, tier, ngày tạo, số tài liệu

**Tìm kiếm user:**
Gõ email hoặc tên vào ô search ở góc trên phải.

**Lọc theo role/tier:**
Bấm dropdown **"Filter"** → chọn `admin`, `user`, `free`, `pro`.

---

## Thăng cấp user lên Admin

1. Tìm user trong danh sách
2. Bấm nút **"⋯"** (3 chấm) bên phải hàng đó
3. Chọn **"Promote to Admin"**
4. Bấm **"Confirm"** trong hộp thoại xác nhận

Sau đó user sẽ thấy "Admin Dashboard" trong menu của họ ngay lần đăng nhập tiếp theo.

> **Lưu ý:** Admin được promote qua UI có quyền tương đương với bạn. Chỉ promote người bạn tin tưởng.

---

## Hạ cấp Admin về User thường

1. Tìm user trong danh sách
2. Bấm **"⋯"** → **"Revoke Admin"**
3. Xác nhận

> **Không thể hạ cấp Super Admin.** Super Admin là tài khoản có email trong `ADMIN_EMAILS` env var — cần sửa env để thay đổi.

---

## Đổi Tier (Free → Pro)

1. Tìm user
2. Bấm **"⋯"** → **"Change Tier"**
3. Chọn **"Pro"** hoặc **"Free"**
4. Bấm **"Save"**

**Hiệu lực ngay lập tức.** Pro user sẽ có:
- Không giới hạn số tài liệu (thay vì 3)
- Unlimited hearts trong bài tập
- Ưu tiên cao hơn khi dùng key pool

---

## Xóa tài khoản user

> **Cảnh báo: hành động không thể hoàn tác.** Xóa user sẽ xóa toàn bộ tài liệu, khóa học, tiến độ học, và API key của người đó.

1. Tìm user
2. Bấm **"⋯"** → **"Delete Account"**
3. Gõ email của user vào ô xác nhận
4. Bấm **"Delete permanently"**

---

## Xem chi tiết một user

Bấm vào tên user để mở trang chi tiết:

```
User Detail: nguyen@example.com
├── Profile        — tên, email, avatar, ngày tạo
├── Stats          — số tài liệu, khóa học, bài học đã hoàn thành
├── Documents      — danh sách tài liệu đã upload
├── Courses        — danh sách khóa học và tiến độ
└── API Keys       — danh sách key cá nhân (chỉ xem tên, không xem giá trị)
```

---

## Xử lý yêu cầu nâng cấp tier

Khi user bấm **"Request Pro Upgrade"** trong app, admin nhận thông báo:
- Notification badge trên Admin Dashboard
- Hoặc email (nếu đã cấu hình SMTP)

Xử lý: Admin Dashboard → Users → tab **"Upgrade Requests"** → Approve / Reject.
