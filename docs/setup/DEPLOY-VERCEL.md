# Deploy lên Vercel (Production)

Hướng dẫn deploy LearnForge lên Vercel + Neon (PostgreSQL miễn phí).

---

## Yêu cầu

- Đã chạy được local (xem [QUICKSTART.md](QUICKSTART.md))
- Tài khoản Vercel: https://vercel.com/signup (free)
- Tài khoản Neon: https://neon.tech (free tier 0.5GB)
- Vercel CLI: `npm i -g vercel`

---

## Bước 1: Tạo database trên Neon

1. Đăng nhập vào https://neon.tech
2. Bấm **"New Project"**
3. Đặt tên project: `learnforge-prod`
4. Region: chọn gần nhất (Singapore nếu ở Việt Nam)
5. Bấm **"Create project"**
6. Trên trang dashboard, copy connection string dạng:
   ```
   postgresql://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

Lưu lại — đây là `DATABASE_URL` cho production.

---

## Bước 2: Chuẩn bị Vercel Blob (file storage)

Vercel Blob dùng để lưu file PDF/DOCX người dùng upload thay vì local filesystem.

1. Vào https://vercel.com → project của bạn (hoặc tạo mới ở Bước 3)
2. Tab **Storage → Blob → Create**
3. Sau khi tạo, copy `BLOB_READ_WRITE_TOKEN`

---

## Bước 3: Deploy

```bash
vercel
```

Lần đầu sẽ hỏi vài câu:
- `Set up and deploy?` → **Y**
- `Which scope?` → chọn account của bạn
- `Link to existing project?` → **N** (tạo mới)
- `Project name?` → `learnforge` hoặc tên bạn muốn
- `In which directory is your code located?` → nhấn Enter (`.`)

---

## Bước 4: Cấu hình Environment Variables

Vào Vercel Dashboard → **Settings → Environment Variables** và thêm từng biến:

```env
# Database
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require

# Auth
AUTH_SECRET=<giống .env.local>
NEXTAUTH_URL=https://your-project.vercel.app
ENCRYPTION_SECRET=<giống .env.local>
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app

# Admin
ADMIN_EMAILS=email-của-bạn@gmail.com

# AI
AI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-2.0-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001

# File storage
STORAGE_PROVIDER=vercel-blob
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...

# OAuth (nếu dùng)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

> **Quan trọng:** `NEXTAUTH_URL` phải khớp với domain Vercel của bạn. Nếu dùng custom domain thì dùng domain đó.

---

## Bước 5: Chạy migration trên production DB

```bash
# Tạm thời set DATABASE_URL về Neon
DATABASE_URL="postgresql://...neon.tech/..." npx prisma migrate deploy
```

**Nếu làm đúng:** thấy `All migrations have been applied.`

---

## Bước 6: Deploy production

```bash
vercel --prod
```

**Nếu làm đúng:** cuối cùng thấy URL kiểu:
```
✓ Production: https://learnforge-abc123.vercel.app
```

Mở URL đó trong trình duyệt → thấy trang LearnForge chạy.

---

## Bước 7: Cập nhật OAuth redirect URIs

Nếu dùng Google OAuth hoặc GitHub OAuth, cần thêm URL production:

**Google Console** (https://console.cloud.google.com):
- Thêm vào Authorized redirect URIs:
  - `https://your-project.vercel.app/api/auth/callback/google`

**GitHub** (https://github.com/settings/developers):
- Sửa **Authorization callback URL** thành:
  - `https://your-project.vercel.app/api/auth/callback/github`

---

## Khi cập nhật code

```bash
git push origin main
```

Vercel tự động deploy khi có commit mới vào `main`. Hoặc deploy thủ công:

```bash
vercel --prod
```

---

## Gặp lỗi khi deploy

Xem log tại: Vercel Dashboard → **Deployments → [lần deploy gần nhất] → Functions log**

Các lỗi thường gặp: [TROUBLESHOOTING.md#deploy](TROUBLESHOOTING.md#deploy-vercel)
