# Quickstart — Chạy LearnForge trong 15 phút

Hướng dẫn này dành cho người chưa từng setup dự án web. Mỗi bước đều có cách kiểm tra bạn đang làm đúng.

---

## Yêu cầu trước khi bắt đầu

Kiểm tra từng tool bằng lệnh bên dưới. Nếu chưa có, nhấp link để download.

**Node.js >= 18**
```bash
node --version
```
Nếu thấy `v18.x.x` hoặc cao hơn → OK  
Chưa có: https://nodejs.org (chọn LTS)

**Git**
```bash
git --version
```
Nếu thấy `git version 2.x.x` → OK  
Chưa có: https://git-scm.com/downloads

**Docker Desktop**
```bash
docker --version
```
Nếu thấy `Docker version 24.x.x` → OK  
Chưa có: https://www.docker.com/products/docker-desktop

> **Lưu ý Windows:** Sau khi cài Docker Desktop, khởi động lại máy và đảm bảo Docker Desktop đang chạy (icon ở system tray).

---

## Bước 1: Lấy code về

```bash
git clone https://github.com/your-username/learnforge.git
cd learnforge
```

**Nếu làm đúng:** bạn thấy thư mục `learnforge` xuất hiện và terminal đang ở trong thư mục đó.

---

## Bước 2: Cài dependencies

```bash
npm install
```

Quá trình này mất 1–3 phút. Bình thường thấy rất nhiều chữ chạy.

**Nếu làm đúng:** cuối cùng thấy dòng `added XXX packages` không có chữ `error`.  
**Nếu thấy chữ đỏ `npm error`** → xem [TROUBLESHOOTING.md#npm-install-fail](TROUBLESHOOTING.md#npm-install-fail)

---

## Bước 3: Khởi động database

```bash
docker compose up -d
```

**Nếu làm đúng:** sau đó chạy lệnh sau và thấy container đang chạy:

```bash
docker ps
```

Bạn sẽ thấy một dòng có chữ `postgres` và trạng thái `Up`.

**Nếu không thấy container** → Docker Desktop chưa chạy. Mở Docker Desktop rồi thử lại.

---

## Bước 4: Tạo file cấu hình

```bash
cp .env.example .env.local
```

File này chứa API key và mật khẩu — **KHÔNG được commit lên GitHub**.

Bây giờ mở file `.env.local` và điền từng biến. Xem hướng dẫn chi tiết: [GETTING-API-KEYS.md](GETTING-API-KEYS.md)

**Biến bắt buộc nhất để chạy local:**

```bash
# Copy output của lệnh này vào AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Copy output của lệnh này vào ENCRYPTION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/learnforge"
AUTH_SECRET="<output của lệnh trên>"
NEXTAUTH_URL="http://localhost:3000"
ENCRYPTION_SECRET="<output của lệnh thứ hai>"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Để dùng AI, cần thêm ít nhất một trong các key sau (xem [GETTING-API-KEYS.md](GETTING-API-KEYS.md)):
- `GEMINI_API_KEY` — miễn phí, dễ lấy nhất
- `OPENAI_API_KEY` — mạnh hơn, có phí
- `OLLAMA_BASE_URL` — chạy local, không cần internet

---

## Bước 5: Tạo database tables

```bash
npx prisma migrate dev
```

Lần đầu chạy sẽ hỏi tên migration, gõ `init` rồi nhấn Enter.

**Nếu làm đúng:** thấy dòng `✓ Generated Prisma Client` ở cuối.  
**Nếu thấy lỗi `Can't reach database`** → Docker container chưa chạy, quay lại Bước 3.

---

## Bước 6: Chạy app

```bash
npm run dev
```

**Nếu làm đúng:** thấy:
```
▲ Next.js 14.x.x
- Local: http://localhost:3000
✓ Ready in Xs
```

Mở trình duyệt vào **http://localhost:3000**

Nếu thấy trang LearnForge → **Chúc mừng!**

---

## Bước tiếp theo

- Trở thành admin: [docs/admin/FIRST-RUN-SETUP.md](../admin/FIRST-RUN-SETUP.md)
- Deploy lên production: [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md)
- Gặp lỗi: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
