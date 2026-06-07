# 🚀 Hướng Dẫn Deploy LearnForge Lên Vercel (Phiên Bản 2 — Đầy Đủ Nhất)

Tài liệu này tổng hợp **toàn bộ kinh nghiệm thực tế** sau khi đã chạy thử production và fix các lỗi phát sinh:

- ❌ Lỗi `column UserApiKey.name does not exist` (digest 252205326) — do migration không tự chạy.
- ❌ Lỗi `mkdir './uploads'` trên upload — do filesystem Vercel read-only.
- ❌ Lỗi pg-boss `Connection terminated due to connection timeout` — do serverless không chạy được background worker.
- ❌ Lỗi `Failed to execute 'json' on 'Response'` khi upload file.

Phiên bản này dùng **Vercel Blob** (lưu file) + **Inngest** (queue background job) thay cho local disk + pg-boss. Nhờ đó toàn bộ pipeline upload → ingest → curriculum → exercises chạy thành công 100% trên serverless.

---

## 🗺️ Tổng Quan Kiến Trúc

```
[User Browser]
      │  upload PDF
      ▼
┌─────────────────────────┐
│  Vercel Serverless      │   /api/upload
│  /api/upload (3-5s)     │
│   1. put() → Vercel Blob│ ────► [Vercel Blob Storage]
│   2. inngest.send()     │ ────► [Inngest Cloud Queue]
│   3. return 200         │
└─────────────────────────┘
      │
      ▼ async (không bị giới hạn 10s)
┌─────────────────────────┐
│  Inngest Worker         │   /api/inngest (called by Inngest)
│   - download blob       │
│   - parse PDF (Gemini)  │
│   - chunk + embed       │
│   - save to Postgres    │ ────► [Neon Postgres + pgvector]
│   - emit curriculum evt │
└─────────────────────────┘
```

**6 dịch vụ bên ngoài bạn cần:**

| Dịch vụ | Mục đích | Free tier |
|---|---|---|
| GitHub | Lưu source code | ✅ Free |
| Vercel | Host Next.js | ✅ Hobby plan |
| Neon | Postgres + pgvector | ✅ 0.5GB free |
| Vercel Blob | Lưu file PDF | ✅ 1GB free |
| Inngest | Background job queue | ✅ 50,000 runs/tháng |
| Google Gemini | LLM + embedding | ✅ Free tier rộng |

Tổng chi phí khởi đầu: **0 đồng**.

---

## 📋 Giai Đoạn 1: Chuẩn Bị Tài Khoản

Đăng ký 4 tài khoản (đăng nhập bằng GitHub cho tất cả để đỡ tốn thời gian):

1. **GitHub** — [github.com/signup](https://github.com/signup)
2. **Vercel** — [vercel.com/signup](https://vercel.com/signup) → "Continue with GitHub"
3. **Neon Tech** — [neon.tech](https://neon.tech/) → "Sign up with GitHub"
4. **Inngest** — [inngest.com](https://www.inngest.com/) → "Sign up with GitHub"

**Cài CLI tools trên máy local:**

```powershell
# Node.js >= 18
node --version

# Vercel CLI (để xem log, set env vars)
npm install -g vercel
vercel login
```

---

## 💻 Giai Đoạn 2: Đẩy Code Lên GitHub

Trong thư mục `c:\Turin\LearnForge`:

```powershell
git init                              # nếu chưa init
git add .
git commit -m "first commit"
```

Sau đó vào [github.com/new](https://github.com/new) tạo repo `learn-forge` (Private hoặc Public đều được, **KHÔNG** tick "Add a README").

Copy 2 lệnh GitHub gợi ý dán vào terminal:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/learn-forge.git
git push -u origin master
```

> ⚠️ **Quan trọng:** Branch của repo này là `master`, không phải `main`. Khi push hãy dùng `master`.

---

## 🗄️ Giai Đoạn 3: Tạo Database Trên Neon

1. Vào [Neon Console](https://console.neon.tech) → **Create Project**.
2. Điền:
   - **Project name:** `learnforge`
   - **Database name:** `learnforge`
   - **Region:** `Singapore (ap-southeast-1)` (cho người dùng VN nhanh nhất)
   - **Postgres version:** giữ mặc định (16+)
3. Nhấn **Create Project**.
4. Sau khi tạo xong, ở dashboard project sẽ thấy box "Connect to your database":
   - Đảm bảo công tắc **Connection pooling** đang **BẬT** (xanh).
   - Nhấn 👁️ để hiện password.
   - **Copy toàn bộ Connection String** dạng `postgresql://neondb_owner:xxx@xxx.aws.neon.tech/neondb?sslmode=require`
   - **Lưu vào Notepad** với nhãn `DATABASE_URL`.

**Bật extension `vector` (cho RAG):**

Vẫn ở Neon dashboard, mở **SQL Editor** (sidebar) → chạy:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Nếu báo "extension already exists" thì cũng OK.

---

## ☁️ Giai Đoạn 4: Tạo Vercel Blob Storage

1. Vào [Vercel Dashboard](https://vercel.com/dashboard) → tab **Storage** (sidebar trái).
2. **Create Database** → chọn **Blob**.
3. Đặt tên `learnforge-uploads` → **Create**.
4. Sau khi tạo xong sẽ thấy nút **Connect to Project** → **chưa chọn project ngay** (vì project chưa import). Để đó, lát quay lại.

> 💡 Vercel Blob sẽ tự inject `BLOB_READ_WRITE_TOKEN` vào env vars của project khi bạn connect ở Giai đoạn 7. Bạn KHÔNG cần copy token thủ công.

---

## 🔁 Giai Đoạn 5: Tạo Inngest App

1. Vào [app.inngest.com](https://app.inngest.com).
2. Lần đầu sẽ vào wizard onboarding — **bỏ qua** bằng cách click **"I already have an Inngest app"** hoặc click vào logo Inngest trên trái để về dashboard chính.
3. Trên cùng sidebar trái sẽ có dropdown **"Production"** và bên cạnh là icon **🔑** — click icon 🔑 (đây là trang Manage Keys).

   Hoặc vào URL trực tiếp: `https://app.inngest.com/env/production/manage/keys`

**Lấy Event Key:**

4. Tab **Event Keys** → nhấn **Create Event Key** → đặt tên `learn-forge-key` → Save.
5. Click vào key vừa tạo → click 👁️ "reveal" → **copy giá trị** (chuỗi dài bắt đầu bằng các ký tự ngẫu nhiên).
6. **Lưu vào Notepad** với nhãn `INNGEST_EVENT_KEY`.

**Lấy Signing Key:**

7. Sidebar **Manage** → tab **Signing Key** (hoặc URL trực tiếp `https://app.inngest.com/env/production/manage/signing-key`).
8. Click 👁️ reveal → **copy** giá trị (dạng `signkey-prod-xxxxx...`).
9. **Lưu vào Notepad** với nhãn `INNGEST_SIGNING_KEY`.

> 📝 Bước **Sync app với URL Vercel** sẽ làm sau ở Giai đoạn 9 (vì app chưa deploy).

---

## ⚙️ Giai Đoạn 6: Chuẩn Bị Đầy Đủ Biến Môi Trường

Mở Notepad và chuẩn bị **18 biến** sau (sẽ dán vào Vercel ở Giai đoạn 7):

### A. Biến đã có giá trị (lấy từ các giai đoạn trước)

| Tên biến | Giá trị | Lấy từ |
|---|---|---|
| `DATABASE_URL` | `postgresql://...neon.tech/neondb?sslmode=require` | Giai đoạn 3 |
| `INNGEST_EVENT_KEY` | (chuỗi dài đã copy) | Giai đoạn 5 |
| `INNGEST_SIGNING_KEY` | `signkey-prod-...` | Giai đoạn 5 |

### B. Biến cấu hình AI (dùng Gemini free)

Lấy Gemini API key tại [aistudio.google.com/apikey](https://aistudio.google.com/apikey):

| Tên biến | Giá trị |
|---|---|
| `AI_PROVIDER` | `gemini` |
| `GEMINI_API_KEY` | `AIzaSy...` (key Gemini của bạn) |
| `GEMINI_API_KEY_INGEST` | Giống `GEMINI_API_KEY` (hoặc dùng key thứ 2 nếu muốn tách quota) |
| `GEMINI_MODEL` | `gemini-2.5-flash` |

### C. Biến Google OAuth (cho login)

Nếu chưa có, tạo tại [Google Cloud Console](https://console.cloud.google.com):
- APIs & Services → Credentials → Create OAuth 2.0 Client ID → Web application
- Authorized redirect URI tạm thời để trống — sẽ thêm sau ở Giai đoạn 10.

| Tên biến | Giá trị |
|---|---|
| `GOOGLE_CLIENT_ID` | `xxxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxxx` |

### D. Biến cấu hình app

| Tên biến | Giá trị |
|---|---|
| `STORAGE_PROVIDER` | `vercel-blob` ⚠️ **BẮT BUỘC trên Vercel** — quyết định lưu file lên Vercel Blob và đẩy background job qua Inngest. Nếu thiếu (mặc định `local`), upload sẽ cố ghi đĩa read-only + chạy pg-boss → lỗi. Local dev để `local`. |
| `ADMIN_EMAILS` | Email của bạn (VD: `brolai1204@gmail.com`) — sẽ được tự động gán role `admin` khi đăng nhập |
| `MAX_UPLOAD_SIZE_MB` | `50` |
| `MAX_DOCUMENTS_FREE` | `3` |

### E. Biến bảo mật (cần tự generate)

Mở PowerShell, chạy lệnh này **3 lần** để có 3 chuỗi khác nhau (hoặc dùng cùng 1 chuỗi cho cả 3 cũng OK):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

| Tên biến | Giá trị |
|---|---|
| `NEXTAUTH_SECRET` | (chuỗi 64 ký tự hex) |
| `AUTH_SECRET` | (giống `NEXTAUTH_SECRET` cho đơn giản) |
| `ENCRYPTION_SECRET` | (chuỗi 64 ký tự hex — dùng để mã hóa BYOK keys) |

### F. Biến URL (điền sau khi Vercel cấp link ở Giai đoạn 7)

| Tên biến | Giá trị (điền sau) |
|---|---|
| `NEXTAUTH_URL` | `https://learn-forge-xxx.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | `https://learn-forge-xxx.vercel.app` |

### G. Biến tự động (KHÔNG cần điền thủ công)

Vercel auto-inject 2 biến này, đừng thêm tay:

- `BLOB_READ_WRITE_TOKEN` (auto khi connect Blob ở Giai đoạn 7)
- `VERCEL` = `1` (Vercel set sẵn để code phân biệt môi trường)

> 📊 **Tổng cộng:** 16 biến bạn nhập tay + 2 biến tự động = 18 biến.

---

## 🚀 Giai Đoạn 7: Import Project Lên Vercel

1. Vercel Dashboard → **Add New** → **Project**.
2. Chọn repo `learn-forge` → **Import**.
3. Phần **Configure Project**:
   - **Framework Preset:** Next.js (auto-detect)
   - **Build Command:** giữ mặc định (sẽ dùng `npm run build` từ `package.json`, lệnh này đã được sửa thành `prisma migrate deploy && prisma generate && next build` để **tự động chạy migration mỗi lần deploy**).
   - **Output Directory:** giữ mặc định
   - **Install Command:** giữ mặc định
4. Mở rộng phần **Environment Variables**:
   - Copy-paste từng cặp `Name` + `Value` từ Notepad (Giai đoạn 6, mục A–E).
   - Tick cả 3 checkbox **Production / Preview / Development** cho mỗi biến.
   - **Bỏ qua** mục F (URL) — chưa có link, lát quay lại điền.
5. Nhấn nút **Deploy** màu trắng to.

**Trong khi Vercel build (~2-3 phút), connect Blob:**

6. Tab **Storage** (sidebar) → click vào `learnforge-uploads` đã tạo ở Giai đoạn 4.
7. Click **Connect to Project** → chọn project `learn-forge` vừa tạo → tick cả Production + Preview + Development → **Connect**.
8. Vercel sẽ tự thêm `BLOB_READ_WRITE_TOKEN` vào project — bạn không cần làm gì thêm.

**Build xong, lấy URL:**

9. Quay lại tab **Deployments** của project. Sau ~3 phút sẽ có 1 deployment ✅ Ready.
10. Click vào deployment → copy URL dạng `https://learn-forge-xxx.vercel.app`.
11. **Lưu URL này** — sẽ dùng ở Giai đoạn 8 và 9.

---

## 🔧 Giai Đoạn 8: Điền Nốt 2 Biến URL & Redeploy

1. Project → **Settings** → **Environment Variables** → **Add New**:
   - Name: `NEXTAUTH_URL` | Value: `https://learn-forge-xxx.vercel.app` (dán URL bước 10)
   - Name: `NEXT_PUBLIC_APP_URL` | Value: cùng URL ở trên
   - Tick cả Production + Preview + Development cho cả 2.
2. Vào tab **Deployments** → tìm bản mới nhất → click **⋯** (ba chấm) → **Redeploy** → **Redeploy** (tick "Use existing Build Cache" cho nhanh).

> ✅ Lúc này build script `prisma migrate deploy && prisma generate && next build` sẽ tự động chạy migration trên Neon. Bạn **không cần chạy `prisma migrate deploy` thủ công** nữa — đó chính là fix cho bug `column UserApiKey.name does not exist`.

**Verify migration đã chạy:**

Vercel Dashboard → Deployments → click deployment mới nhất → tab **Build Logs** → tìm dòng:

```
> prisma migrate deploy
Datasource "db": PostgreSQL database
N migrations found in prisma/migrations
Applying migration `20260426203225_init`
Applying migration `20260430000000_exercise_gamification_schema`
...
All migrations have been successfully applied.

> next build
✓ Compiled successfully
```

Nếu thấy `All migrations have been successfully applied` là OK.

---

## 🔁 Giai Đoạn 9: Sync Inngest Với App Đã Deploy

Sau khi redeploy ở Giai đoạn 8, endpoint `/api/inngest` đã sống. Bây giờ báo cho Inngest biết URL này:

1. Vào [app.inngest.com](https://app.inngest.com) → sidebar **Apps**.
2. Nếu chưa có app nào → click **Sync new app**. Nếu có rồi → click app `learn-forge` → tab **Sync**.
3. Nhập URL: `https://learn-forge-xxx.vercel.app/api/inngest` (thay xxx bằng subdomain thật của bạn).
4. Click **Sync App**.

Inngest sẽ gửi 1 request đến endpoint của bạn để discover functions. Nếu sync thành công, bạn sẽ thấy app `learn-forge` xuất hiện với **3 functions**:

- ✅ `ingest-document` (trigger: `app/document.uploaded`)
- ✅ `generate-curriculum` (trigger: `app/course.curriculum-requested`)
- ✅ `generate-exercises` (trigger: `app/lesson.exercises-requested`)

Nếu sync fail, kiểm tra:
- Env var `INNGEST_SIGNING_KEY` đã set đúng trên Vercel chưa?
- URL có đúng không (phải kết thúc bằng `/api/inngest`)?
- Endpoint `https://learn-forge-xxx.vercel.app/api/inngest` mở trực tiếp trên browser phải trả về JSON `{"message":"..."}`.

---

## 🔑 Giai Đoạn 10: Cấu Hình Google OAuth Cho Web Thật

1. Vào [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials**.
2. Click vào OAuth 2.0 Client ID đã tạo ở Giai đoạn 6 mục C.
3. Phần **Authorized redirect URIs** → click **+ ADD URI**:

   ```
   https://learn-forge-xxx.vercel.app/api/auth/callback/google
   ```
4. Phần **Authorized JavaScript origins** → **+ ADD URI**:

   ```
   https://learn-forge-xxx.vercel.app
   ```
5. **Save**.

> ⚠️ Mỗi khi domain Vercel thay đổi (dùng custom domain) phải quay lại đây thêm URI mới.

---

## ✅ Giai Đoạn 11: Verify End-to-End

1. Mở `https://learn-forge-xxx.vercel.app` → bấm **Sign in with Google**.
2. Login bằng email đã đặt ở `ADMIN_EMAILS` → sẽ tự động được cấp role `admin`.
3. Hoàn thành onboarding (chọn avatar, daily goal).
4. Vào `/app/dashboard` → phải hiển thị bình thường (không còn "Application error").
5. Vào `/app/upload` → upload một PDF nhỏ (5-10 trang).
6. Mở [app.inngest.com](https://app.inngest.com) → tab **Runs** → sẽ thấy run của `ingest-document` đang chạy.
7. Sau ~30s → run hoàn tất → kế tiếp run `generate-curriculum` chạy.
8. Sau ~1-2 phút → curriculum xong → 3 runs `generate-exercises` chạy song song.
9. Quay lại `/app/dashboard` → course xuất hiện với status `ready`.
10. Click vào course → vào lesson → làm bài exercise → ✅ App hoạt động hoàn toàn!

---

## 🛠️ Phụ Lục A: Các Code Changes Cần Có

Tất cả các thay đổi này **đã có sẵn trong commit hiện tại** (master branch). Liệt kê để tham khảo:

### A.1. `package.json` — Build script tự chạy migration

```json
{
  "scripts": {
    "build": "prisma migrate deploy && prisma generate && next build"
  }
}
```

Mỗi lần Vercel build sẽ tự apply migrations mới lên database. Đây là cách fix bug `column does not exist`.

### A.2. Pipeline upload mới (Vercel Blob + Inngest)

**Files mới:**
- `lib/inngest/client.ts` — Inngest client với typed events
- `lib/inngest/functions.ts` — 3 background functions (ingest, curriculum, exercises)
- `app/api/inngest/route.ts` — webhook endpoint Inngest gọi

**Files đã sửa:**
- `app/api/upload/route.ts` — thay `writeFile` bằng `put()` từ `@vercel/blob`, gửi event `app/document.uploaded` thay vì fire-and-forget
- `lib/upload/parser.ts` — `parseFile(filePath)` → `parseBuffer(buffer, fileName)` (worker pass buffer trực tiếp)
- `lib/upload/ingest.ts` — fetch file từ Blob URL bằng `fetch()`, emit Inngest event cho curriculum
- `lib/ai/generators/curriculum.ts` — gửi event `app/lesson.exercises-requested` thay vì `sendJob()`
- `app/api/courses/route.ts` & `app/api/generate/curriculum/route.ts` — `sendJob()` → `inngest.send()`

### A.3. Migration mới cho UserApiKey + UserModelConfig

File `prisma/migrations/20260506000000_update_user_api_key_add_model_config/migration.sql` đã có sẵn — sẽ tự chạy khi build.

### A.4. Skip pg-boss workers trên Vercel

`instrumentation.ts`:

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.VERCEL) {
    const { startWorkers } = await import("@/lib/queue/workers");
    await startWorkers();
  }
}
```

`!process.env.VERCEL` đảm bảo pg-boss chỉ chạy ở local dev (nơi nó hoạt động). Trên Vercel, Inngest thay thế hoàn toàn.

---

## 🐛 Phụ Lục B: Troubleshooting

### Lỗi "Application error" trên dashboard / digest 252205326

**Nguyên nhân:** Migration chưa apply trên Neon.

**Fix:**
1. Verify build script trong `package.json` có `prisma migrate deploy`.
2. Vercel Dashboard → Deployments → bản mới nhất → **Build Logs** → tìm `All migrations have been successfully applied`.
3. Nếu không thấy → kiểm tra `DATABASE_URL` env var có đúng không, có `?sslmode=require` không.
4. Chạy thủ công 1 lần để chắc:
   ```powershell
   $env:DATABASE_URL = "postgresql://..."
   npx prisma migrate deploy
   ```

### Lỗi upload "Failed to execute 'json' on 'Response'"

**Nguyên nhân:** API trả về 500 (HTML error page). Kiểm tra Vercel logs:

```powershell
vercel logs --since 10m --no-follow --expand --no-branch
```

Các nguyên nhân hay gặp:
- `BLOB_READ_WRITE_TOKEN` chưa connect → vào Storage → connect Blob.
- `INNGEST_EVENT_KEY` chưa set → Inngest `.send()` throw.
- Migration chưa chạy → Prisma error.

### Inngest sync fail

- Mở browser truy cập `https://your-app.vercel.app/api/inngest` — phải trả về JSON, không phải 404/500.
- Nếu 401/403 → `INNGEST_SIGNING_KEY` sai hoặc thiếu trong env.
- Nếu 404 → file `app/api/inngest/route.ts` không có hoặc deploy chưa cập nhật.

### Function timeout trên Inngest run

- Vào Inngest dashboard → Run → xem step nào bị timeout.
- Nếu Gemini chậm → giảm `BATCH_SIZE` trong `lib/upload/ingest.ts` (hiện tại = 5).
- Hoặc thêm `timeouts: { finish: '15m' }` vào function definition trong `lib/inngest/functions.ts`.

### Inngest dev local

```powershell
npx inngest-cli@latest dev
```

Inngest dev server chạy ở `http://localhost:8288`. Mở Next.js dev (`npm run dev`) song song. Inngest tự discover endpoint local `http://localhost:3000/api/inngest`. Không cần `INNGEST_EVENT_KEY` cho dev mode.

---

## 🎉 Hoàn Tất

Sau khi chạy hết Giai đoạn 1-11, bạn có:

- ✅ Code trên GitHub
- ✅ Web sống trên Vercel với SSL miễn phí
- ✅ Database Neon Postgres + pgvector
- ✅ File storage Vercel Blob
- ✅ Background jobs qua Inngest (retry tự động, dashboard monitoring)
- ✅ Migration tự apply mỗi lần deploy
- ✅ Login Google + role admin
- ✅ Pipeline upload → ingest → curriculum → exercises chạy 100% trên serverless

**Mỗi lần update code:**

```powershell
git add .
git commit -m "feat: ..."
git push origin master
```

Vercel sẽ tự deploy + tự chạy migration. Inngest tự re-sync functions. Bạn không phải làm gì thêm.

Tận hưởng thành quả! 🔥
