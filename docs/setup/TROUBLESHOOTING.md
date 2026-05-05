# Troubleshooting — Lỗi thường gặp

Tìm lỗi của bạn trong danh sách bên dưới. Mỗi lỗi có triệu chứng, nguyên nhân, và cách fix.

---

## Mục lục

- [npm install fail](#npm-install-fail)
- [Docker / Database không kết nối được](#docker-database-khong-ket-noi-duoc)
- [prisma migrate dev lỗi](#prisma-migrate-dev-loi)
- [Lỗi đăng nhập / Auth](#loi-dang-nhap-auth)
- [AI không hoạt động](#ai-khong-hoat-dong)
- [Upload file lỗi](#upload-file-loi)
- [Deploy Vercel lỗi](#deploy-vercel)
- [Encryption / BYOK lỗi](#encryption-byok-loi)

---

## npm install fail

**Triệu chứng:** Thấy dòng `npm error code ERESOLVE` hoặc `peer dependency conflict`.

**Cách fix:**
```bash
npm install --legacy-peer-deps
```

Nếu vẫn lỗi:
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## Docker / Database không kết nối được

**Triệu chứng:** `prisma migrate dev` báo `Can't reach database server at localhost:5433`.

**Kiểm tra Docker đang chạy:**
```bash
docker ps
```
Phải thấy container tên `learnforge-postgres-1` (hoặc tương tự) với status `Up`.

**Nếu container không chạy:**
```bash
docker compose up -d
```

**Nếu port 5433 bị chiếm:**
```bash
# Windows
netstat -ano | findstr :5433

# Tắt process đang dùng port đó, hoặc đổi port trong docker-compose.yml và DATABASE_URL
```

**Nếu Docker Desktop không mở được trên Windows:**
- Kiểm tra WSL2 đã cài: `wsl --status`
- Khởi động lại Docker Desktop với quyền Admin

---

## prisma migrate dev lỗi

**Triệu chứng:** `Error: P1001: Can't reach database` hoặc `There is already a database...`

**Database chưa chạy:** Xem phần Docker bên trên.

**Migration conflict (khi pull code mới):**
```bash
npx prisma migrate dev --name fix
```

**Reset database hoàn toàn (xóa hết dữ liệu):**
```bash
npx prisma migrate reset
```

**Lỗi pgvector extension:**
```
ERROR: extension "vector" is not available
```
Docker image trong `docker-compose.yml` phải là `pgvector/pgvector:pg16`, không phải `postgres:16`. Kiểm tra file `docker-compose.yml`.

---

## Lỗi đăng nhập / Auth

**Triệu chứng:** Redirect loop sau khi đăng nhập, hoặc `OAuthAccountNotLinked`.

**AUTH_SECRET chưa điền:**
Kiểm tra `.env.local` có dòng `AUTH_SECRET=...` không (không được để trống).

**NEXTAUTH_URL sai:**
Local phải là `http://localhost:3000`. Production phải là URL Vercel thực tế, **không có trailing slash**.

**OAuthAccountNotLinked:**
Email đã tồn tại trong DB bằng email/password, nhưng bạn đang đăng nhập bằng Google/GitHub với cùng email đó. Giải pháp: đăng nhập bằng email/password, sau đó link OAuth account trong settings.

**Cookie không hoạt động local:**
Đảm bảo dùng `http://localhost:3000`, không phải `http://127.0.0.1:3000`.

---

## AI không hoạt động

**Triệu chứng:** Upload tài liệu xong status mãi là `processing`, hoặc generate curriculum lỗi.

**Kiểm tra AI key đã điền chưa:**
```bash
# Nếu dùng Gemini
echo $GEMINI_API_KEY  # Linux/Mac
$env:GEMINI_API_KEY   # Windows PowerShell
```

**Kiểm tra key hợp lệ:**
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY"
```
Nếu thấy `"error": {"code": 400}` → key sai.  
Nếu thấy `"error": {"code": 429}` → hết quota ngày hôm nay.

**Ollama không phản hồi:**
```bash
curl http://localhost:11434/api/tags
```
Nếu lỗi → Ollama chưa chạy. Chạy lại: `ollama serve`

**Model chưa pull:**
```bash
ollama list
```
Nếu không thấy model trong danh sách → `ollama pull llama3.1`

---

## Upload file lỗi

**Triệu chứng:** Upload xong file nhưng status là `error`, hoặc lỗi 413.

**File quá lớn (>50MB):**
Kiểm tra `MAX_UPLOAD_SIZE_MB` trong `.env.local`. Giá trị mặc định là 50.

**Thư mục uploads chưa tồn tại:**
```bash
mkdir uploads
```

**Hết slot tài liệu (free tier):**
Free tier mặc định 3 tài liệu. Kiểm tra `MAX_DOCUMENTS_FREE` trong `.env.local`.

---

## Deploy Vercel

**Triệu chứng:** Build failed trên Vercel.

**Xem log chi tiết:**
Vercel Dashboard → Deployments → click lần deploy lỗi → tab **"Build Logs"**

**Lỗi `PrismaClientInitializationError` trên production:**
Kiểm tra `DATABASE_URL` trên Vercel đã điền đúng Neon connection string (có `?sslmode=require` ở cuối).

**Lỗi `NEXTAUTH_URL` không khớp:**
`NEXTAUTH_URL` trên Vercel phải khớp chính xác URL deploy, ví dụ: `https://learnforge.vercel.app` (không có slash cuối).

**Migration chưa chạy trên production:**
```bash
DATABASE_URL="postgres://...neon..." npx prisma migrate deploy
```

---

## Encryption / BYOK lỗi

**Triệu chứng:** Lưu API key báo lỗi `Encryption failed`, hoặc load key báo `Decryption failed`.

**ENCRYPTION_SECRET chưa điền hoặc sai format:**
Biến này phải là chuỗi hex 64 ký tự. Sinh lại:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **Cảnh báo:** Nếu bạn đổi `ENCRYPTION_SECRET` sau khi đã có key được lưu trong DB, tất cả key cũ sẽ không decrypt được. Người dùng sẽ cần nhập lại key. Đừng đổi giá trị này sau khi đã deploy production.

---

Vẫn gặp lỗi không có trong danh sách? Mở issue tại: https://github.com/your-username/learnforge/issues
