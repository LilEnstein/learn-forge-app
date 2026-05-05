# 🚀 DEPLOY-VERCEL.md
# Hướng dẫn Deploy LearnForge lên Vercel

> Thời gian: khoảng 30–45 phút nếu làm lần đầu.  
> Yêu cầu: đã chạy được local theo QUICKSTART.md.

---

## Mục lục

- [Tổng quan](#tổng-quan)
- [Phần 1: Chuẩn bị Database (Neon)](#phần-1-chuẩn-bị-database-neon)
- [Phần 2: Chuẩn bị File Storage (Vercel Blob)](#phần-2-chuẩn-bị-file-storage-vercel-blob)
- [Phần 3: Chuẩn bị Google OAuth cho production](#phần-3-chuẩn-bị-google-oauth-cho-production)
- [Phần 4: Deploy lên Vercel](#phần-4-deploy-lên-vercel)
- [Phần 5: Cấu hình Environment Variables](#phần-5-cấu-hình-environment-variables)
- [Phần 6: Chạy Migration trên Production DB](#phần-6-chạy-migration-trên-production-db)
- [Phần 7: Commit và Push code](#phần-7-commit-và-push-code)
- [Phần 8: Kiểm tra sau deploy](#phần-8-kiểm-tra-sau-deploy)
- [Troubleshooting](#troubleshooting)

---

## Tổng quan

Khi deploy lên Vercel, bạn cần thay thế 3 thứ đang chạy local:

| Local | Production |
|---|---|
| PostgreSQL Docker | **Neon** (Postgres serverless, free) |
| `./uploads` folder | **Vercel Blob** (file storage) |
| `http://localhost:3000` | `https://your-app.vercel.app` |

---

## Phần 1: Chuẩn bị Database (Neon)

Neon là Postgres serverless — miễn phí, tích hợp ngay với Vercel, không cần cài gì.

### Bước 1.1 — Tạo tài khoản Neon

1. Vào **https://neon.tech**
2. Bấm **"Sign Up"** → đăng ký bằng GitHub (nhanh nhất)
3. Bấm **"Create Project"**
4. Điền thông tin:
   - **Project name:** `learnforge`
   - **Database name:** `learnforge`
   - **Region:** chọn **Singapore** (gần Việt Nam nhất)
5. Bấm **"Create Project"**

✅ **Kiểm tra:** Bạn thấy trang dashboard với tên project "learnforge"

### Bước 1.2 — Lấy Connection String

1. Trong Neon dashboard, tìm tab **"Connection Details"**
2. Chọn **"Pooled connection"** (quan trọng cho Vercel serverless)
3. Copy chuỗi connection trông như thế này:

```
postgresql://learnforge_owner:abc123@ep-xyz.ap-southeast-1.aws.neon.tech/learnforge?sslmode=require
```

4. **Lưu lại** — bạn sẽ cần nó ở Phần 5

⚠️ **Lưu ý:** Chuỗi này chứa mật khẩu. Không chia sẻ với ai, không commit lên GitHub.

---

## Phần 2: Chuẩn bị File Storage (Vercel Blob)

Vercel Blob thay thế thư mục `./uploads` local. Files PDF người dùng upload sẽ lưu ở đây.

### Bước 2.1 — Tạo tài khoản Vercel (nếu chưa có)

1. Vào **https://vercel.com**
2. Bấm **"Sign Up"** → chọn **"Continue with GitHub"**
3. Authorize Vercel truy cập GitHub

✅ **Kiểm tra:** Bạn vào được dashboard Vercel

### Bước 2.2 — Tạo Blob Store

1. Trong Vercel dashboard, vào **Storage** tab (menu trái)
2. Bấm **"Create Database"**
3. Chọn **"Blob"**
4. Đặt tên: `learnforge-uploads`
5. Bấm **"Create"**
6. Vào tab **".env.local"** trong Blob store vừa tạo
7. Copy giá trị của `BLOB_READ_WRITE_TOKEN`

✅ **Kiểm tra:** Bạn thấy token bắt đầu bằng `vercel_blob_rw_...`

---

## Phần 3: Chuẩn bị Google OAuth cho production

Google OAuth local đang dùng `http://localhost:3000`. Production cần URL thật.

### Bước 3.1 — Cập nhật Google Cloud Console

1. Vào **https://console.cloud.google.com**
2. Chọn project LearnForge của bạn
3. Vào **APIs & Services → Credentials**
4. Bấm vào OAuth 2.0 Client ID đang dùng
5. Trong **"Authorized redirect URIs"**, bấm **"+ ADD URI"**
6. Thêm: `https://YOUR-APP-NAME.vercel.app/api/auth/callback/google`

   (Chưa biết URL Vercel? Tạm thời bỏ qua, quay lại sau Bước 4.3)

7. Bấm **"Save"**

---

## Phần 4: Deploy lên Vercel

### Bước 4.1 — Push code lên GitHub (nếu chưa có)

Mở terminal trong thư mục dự án:

```bash
# Kiểm tra git đã được init chưa
git status

# Nếu chưa có git, khởi tạo
git init
git add .
git commit -m "feat: initial commit"
```

Tạo repository trên GitHub:
1. Vào **https://github.com/new**
2. Đặt tên: `learnforge`
3. Chọn **Private** (khuyến nghị) hoặc Public
4. **KHÔNG** tick "Initialize repository" (đã có code rồi)
5. Bấm **"Create repository"**

Copy lệnh từ GitHub và chạy:

```bash
git remote add origin https://github.com/YOUR-USERNAME/learnforge.git
git branch -M main
git push -u origin main
```

✅ **Kiểm tra:** Vào `https://github.com/YOUR-USERNAME/learnforge` thấy code của bạn

### Bước 4.2 — Import project vào Vercel

1. Trong Vercel dashboard, bấm **"Add New → Project"**
2. Chọn **"Import Git Repository"**
3. Tìm và chọn repo `learnforge`
4. Bấm **"Import"**

### Bước 4.3 — Cấu hình build settings

Vercel tự detect Next.js, không cần thay đổi gì. Nhưng **CHƯA bấm Deploy** — cần thêm env vars trước.

**Ghi lại URL của app:** Vercel sẽ cho bạn URL dạng `learnforge-xxx.vercel.app` — copy lại để dùng ở bước tiếp.

---

## Phần 5: Cấu hình Environment Variables

Đây là bước quan trọng nhất. Thiếu một biến là app sẽ crash.

Trong trang import project Vercel, tìm mục **"Environment Variables"**. Thêm từng biến theo bảng dưới:

### 5.1 — Database

| Variable | Value | Lấy từ đâu |
|---|---|---|
| `DATABASE_URL` | `postgresql://...neon.tech/learnforge?sslmode=require` | Neon dashboard (Bước 1.2) |

### 5.2 — Authentication

| Variable | Value | Cách lấy |
|---|---|---|
| `NEXTAUTH_URL` | `https://learnforge-xxx.vercel.app` | URL Vercel của bạn |
| `NEXTAUTH_SECRET` | _(xem bên dưới)_ | Tự generate |
| `AUTH_SECRET` | _(giống NEXTAUTH_SECRET)_ | Copy y chang |

**Tự generate NEXTAUTH_SECRET:**

```bash
# Chạy lệnh này trong terminal (bất kỳ thư mục nào)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy kết quả (64 ký tự hex) và dán vào cả `NEXTAUTH_SECRET` và `AUTH_SECRET`.

### 5.3 — Google OAuth

| Variable | Value | Lấy từ đâu |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `xxx.apps.googleusercontent.com` | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxx` | Google Cloud Console |

### 5.4 — AI Provider

| Variable | Value | Ghi chú |
|---|---|---|
| `AI_PROVIDER` | `gemini` | Hoặc `openai`, `ollama` |
| `GEMINI_API_KEY` | `AIzaSy...` | Google AI Studio |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Model mạnh cho processing |
| `GEMINI_MODEL_LITE` | `gemini-2.0-flash-lite` | Model nhanh cho chat |
| `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-2` | Cho RAG |

### 5.5 — File Storage

| Variable | Value | Lấy từ đâu |
|---|---|---|
| `STORAGE_PROVIDER` | `vercel-blob` | Hardcode giá trị này |
| `BLOB_READ_WRITE_TOKEN` | `vercel_blob_rw_...` | Vercel Blob dashboard (Bước 2.2) |

### 5.6 — Encryption & Security

| Variable | Value | Cách lấy |
|---|---|---|
| `ENCRYPTION_SECRET` | _(xem bên dưới)_ | Tự generate |

```bash
# Generate ENCRYPTION_SECRET (khác với NEXTAUTH_SECRET)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5.7 — Admin Config

| Variable | Value | Ghi chú |
|---|---|---|
| `ADMIN_EMAILS` | `your-email@gmail.com` | Email của bạn, tài khoản đăng nhập đầu tiên sẽ là admin |

### 5.8 — App Config

| Variable | Value | Ghi chú |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://learnforge-xxx.vercel.app` | URL production |
| `MAX_UPLOAD_SIZE_MB` | `50` | Giới hạn file upload |
| `MAX_DOCUMENTS_FREE` | `3` | Giới hạn free tier |

### Checklist env vars

```
□ DATABASE_URL          (có ?sslmode=require ở cuối chưa?)
□ NEXTAUTH_URL          (https://, không có trailing slash)
□ NEXTAUTH_SECRET       (64 ký tự)
□ AUTH_SECRET           (giống NEXTAUTH_SECRET)
□ GOOGLE_CLIENT_ID
□ GOOGLE_CLIENT_SECRET
□ AI_PROVIDER
□ GEMINI_API_KEY
□ GEMINI_MODEL
□ GEMINI_MODEL_LITE
□ GEMINI_EMBEDDING_MODEL
□ STORAGE_PROVIDER      = "vercel-blob"
□ BLOB_READ_WRITE_TOKEN
□ ENCRYPTION_SECRET     (64 ký tự, khác NEXTAUTH_SECRET)
□ ADMIN_EMAILS
□ NEXT_PUBLIC_APP_URL
```

Sau khi điền đủ, bấm **"Deploy"**. Vercel sẽ build ~2-3 phút.

✅ **Kiểm tra:** Build log không có chữ "Error" đỏ. Thấy "✓ Build Completed"

---

## Phần 6: Chạy Migration trên Production DB

App đã deploy nhưng database còn trống — chưa có table nào. Cần chạy migration.

### Bước 6.1 — Cài Vercel CLI

```bash
npm install -g vercel
```

✅ **Kiểm tra:**
```bash
vercel --version
# Phải thấy số version, ví dụ: Vercel CLI 37.x.x
```

### Bước 6.2 — Login Vercel CLI

```bash
vercel login
```

Chọn "Continue with GitHub" → trình duyệt mở ra → authorize → quay lại terminal thấy "✓ Logged in"

### Bước 6.3 — Link project local với Vercel

Trong thư mục dự án:

```bash
vercel link
```

Trả lời các câu hỏi:
- "Set up and deploy?" → **Y**
- "Which scope?" → chọn account của bạn
- "Link to existing project?" → **Y**
- "What's the name of your existing project?" → `learnforge`

✅ **Kiểm tra:** Thấy file `.vercel/project.json` xuất hiện

### Bước 6.4 — Pull env vars về local (để dùng migration)

```bash
vercel env pull .env.production.local
```

File `.env.production.local` sẽ được tạo với tất cả env vars từ Vercel.

⚠️ **Thêm file này vào .gitignore ngay:**

```bash
echo ".env.production.local" >> .gitignore
```

### Bước 6.5 — Chạy migration trên production DB

```bash
# Chạy migration với production DATABASE_URL
npx dotenv -e .env.production.local -- npx prisma migrate deploy
```

Nếu lệnh trên báo lỗi `dotenv not found`:

```bash
npm install -D dotenv-cli
npx dotenv -e .env.production.local -- npx prisma migrate deploy
```

✅ **Kiểm tra:**
```
Applying migration `20240101_init`...
Applying migration `20240102_feature_09`...
All migrations have been applied.
```

### Bước 6.6 — Kiểm tra DB có tables chưa

Vào Neon dashboard → **Tables** tab. Phải thấy các bảng: `User`, `Course`, `Chapter`, `Lesson`, `Exercise`...

Nếu không thấy → quay lại Bước 6.5, kiểm tra DATABASE_URL có đúng không.

---

## Phần 7: Commit và Push code

Đây là lệnh hoàn chỉnh để commit và deploy mỗi khi có thay đổi:

### Workflow chuẩn

```bash
# 1. Kiểm tra những gì đã thay đổi
git status

# 2. Stage tất cả thay đổi
git add .

# 3. Commit với message rõ ràng
git commit -m "feat: mô tả tính năng bạn vừa làm"

# 4. Push lên GitHub → Vercel tự động deploy
git push origin main
```

Sau khi push, Vercel tự động trigger build. Theo dõi tại:
`https://vercel.com/YOUR-USERNAME/learnforge`

⏱️ Build thường mất 1-3 phút.

### Commit message convention

```bash
# Tính năng mới
git commit -m "feat: thêm tính năng BYOK cho người dùng"

# Fix bug
git commit -m "fix: sửa lỗi upload PDF bị timeout"

# Cập nhật config/deploy
git commit -m "chore: cập nhật env vars cho production"

# Cập nhật database schema
git commit -m "feat(db): thêm bảng UserApiKey cho multi-key"
```

### Lệnh deploy khẩn cấp (nếu cần deploy ngay không qua git)

```bash
vercel --prod
```

Lệnh này deploy trực tiếp lên production, bỏ qua GitHub. Chỉ dùng khi cần hotfix gấp.

---

## Phần 8: Kiểm tra sau deploy

Sau khi deploy thành công, kiểm tra theo thứ tự:

### Checklist cơ bản

```
□ Mở https://your-app.vercel.app — thấy trang login
□ Đăng ký tài khoản bằng email
□ Đăng nhập bằng Google OAuth
□ Vào /app/dashboard — thấy dashboard
□ Vào /app/settings — thấy trang Settings
□ Thêm Gemini API key vào Settings — verify thành công
□ Vào /app/upload — upload 1 file PDF test
□ Kiểm tra file xuất hiện trong Vercel Blob dashboard
□ Đăng nhập bằng email trong ADMIN_EMAILS
□ Thấy "Admin Dashboard" trong dropdown avatar
```

### Kiểm tra database hoạt động

```bash
# Chạy lệnh này để kiểm tra kết nối DB production
npx dotenv -e .env.production.local -- npx prisma studio
```

Trình duyệt mở Prisma Studio. Vào bảng `User` — thấy tài khoản bạn vừa đăng ký.

### Kiểm tra logs nếu có lỗi

Trong Vercel dashboard:
1. Vào project → **Functions** tab
2. Bấm vào function bị lỗi
3. Đọc log để biết nguyên nhân

Hoặc dùng CLI:

```bash
vercel logs https://your-app.vercel.app
```

---

## Troubleshooting

### ❌ Lỗi: "Error: DATABASE_URL must start with protocol"

**Nguyên nhân:** DATABASE_URL sai format  
**Fix:** Đảm bảo DATABASE_URL có dạng `postgresql://...` (không phải `postgres://`)  
Neon dùng `postgresql://` — kiểm tra lại

### ❌ Lỗi: "InvalidCheck: pkceCodeVerifier"

**Nguyên nhân:** AUTH_SECRET hoặc NEXTAUTH_SECRET bị thiếu/sai  
**Fix:**
```bash
# Generate lại secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Thêm vào cả `AUTH_SECRET` và `NEXTAUTH_SECRET` trong Vercel env vars.  
Sau đó: Vercel dashboard → **Settings → Environment Variables** → Edit → **Redeploy**

### ❌ Lỗi: "Error: NEXTAUTH_URL is not set"

**Fix:** Thêm vào Vercel env vars:
```
NEXTAUTH_URL = https://your-app.vercel.app
```
Nhớ không có trailing slash `/` ở cuối.

### ❌ Lỗi: Google OAuth redirect_uri_mismatch

**Nguyên nhân:** Google Console chưa có URI production  
**Fix:**
1. Vào Google Cloud Console → Credentials → OAuth Client
2. Thêm: `https://your-app.vercel.app/api/auth/callback/google`
3. Save → chờ 5 phút để Google cập nhật

### ❌ Lỗi: "Cannot find module" khi build

**Nguyên nhân:** Có package trong `devDependencies` thay vì `dependencies`  
**Fix:**
```bash
npm install --save ten-package-bi-loi
git add package.json package-lock.json
git commit -m "fix: move package to dependencies"
git push origin main
```

### ❌ Upload file không lưu được

**Nguyên nhân:** `STORAGE_PROVIDER` không phải `vercel-blob` hoặc `BLOB_READ_WRITE_TOKEN` sai  
**Fix:**
- Kiểm tra `STORAGE_PROVIDER=vercel-blob` (chính xác từng chữ)
- Vào Vercel Blob dashboard → copy lại token mới

### ❌ Migration thất bại: "relation already exists"

**Nguyên nhân:** DB đã có một số tables từ lần migrate trước  
**Fix:**
```bash
npx dotenv -e .env.production.local -- npx prisma migrate resolve --applied "tên_migration_bị_lỗi"
npx dotenv -e .env.production.local -- npx prisma migrate deploy
```

### ❌ Build thành công nhưng app trắng hoàn toàn

**Fix:** Kiểm tra browser console (F12):
- Nếu thấy lỗi env var → kiểm tra `NEXT_PUBLIC_APP_URL`
- Nếu thấy lỗi network → kiểm tra CORS hoặc database connection

---

## Tóm tắt nhanh (chỉ các lệnh quan trọng)

```bash
# ===== Lần đầu setup =====

# 1. Push code lên GitHub
git add .
git commit -m "feat: initial commit"
git push origin main

# 2. Login Vercel CLI
vercel login

# 3. Link project
vercel link

# 4. Pull env vars về local
vercel env pull .env.production.local
echo ".env.production.local" >> .gitignore

# 5. Chạy migration production DB
npx dotenv -e .env.production.local -- npx prisma migrate deploy

# ===== Mỗi lần có thay đổi =====

git add .
git commit -m "feat: mô tả thay đổi"
git push origin main
# → Vercel tự động deploy, chờ 1-3 phút

# ===== Nếu thay đổi database schema =====

# Local: tạo migration mới
npx prisma migrate dev --name ten_migration

# Push code + migration files
git add .
git commit -m "feat(db): thêm bảng mới"
git push origin main

# Chạy migration trên production
npx dotenv -e .env.production.local -- npx prisma migrate deploy

# ===== Deploy khẩn cấp =====
vercel --prod
```
