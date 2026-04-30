# Database Admin Guide

Hướng dẫn xem và sửa dữ liệu trực tiếp trong quá trình phát triển.

---

## Mở Prisma Studio

Prisma Studio là UI trực quan để xem/sửa toàn bộ bảng.

```powershell
# Chạy từ thư mục gốc project
cd C:\Turin\LearnForge
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5433/learnforge"; npx prisma studio
```

Mở trình duyệt tại `http://localhost:5555`.

> **Lưu ý:** Phải `cd` vào thư mục project trước, không chạy từ `C:\WINDOWS\System32`.

---

## Scripts tiện ích

Tất cả scripts dùng `tsx` và đọc `DATABASE_URL` từ env.

### Cú pháp chung

```powershell
cd C:\Turin\LearnForge
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5433/learnforge"; npx tsx scripts/<tên-script>.ts [email] [giá-trị]
```

---

### Thêm / set gems

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5433/learnforge"; npx tsx scripts/add-gems.ts
# Mặc định: brolai1204@gmail.com, 500 gems

# Tùy chỉnh email và số lượng
$env:DATABASE_URL="..."; npx tsx scripts/add-gems.ts user@example.com 1000
```

**File:** `scripts/add-gems.ts`

---

## Các bảng quan trọng

| Bảng | Dùng để |
|---|---|
| `User` | Tài khoản người dùng |
| `UserGamification` | Gems, XP, hearts, streak |
| `Course` | Khoá học |
| `Chapter` / `Lesson` | Chương / bài học |
| `Exercise` | Câu hỏi trong bài |
| `LessonProgress` | Trạng thái học của user (`locked` / `available` / `completed`) |
| `Document` / `DocumentChunk` | PDF đã upload và các chunks RAG |

---

## Reset tiến độ học của một user

Xoá toàn bộ `LessonProgress` để test lại từ đầu:

```sql
-- Chạy trong Prisma Studio > Raw Query, hoặc psql
DELETE FROM "LessonProgress" WHERE "userId" = '<userId>';
```

---

## Kết nối database

| Môi trường | URL |
|---|---|
| Local (Docker) | `postgresql://postgres:postgres@localhost:5433/learnforge` |
| Production (Neon) | Xem `.env.local` — `DATABASE_URL` dòng Neon |

Docker phải đang chạy trước khi dùng local URL.
