# Hướng dẫn chạy LearnForge trên Windows (PowerShell)

Hướng dẫn này viết riêng cho Windows, dùng PowerShell, với Gemini làm AI provider.  
Mỗi bước có lệnh kiểm tra — đừng bỏ qua chúng.

---

## Mục lục

1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Cài đặt Docker Desktop](#2-cài-đặt-docker-desktop)
3. [Fix Docker PATH trên Windows](#3-fix-docker-path-trên-windows)
4. [Clone code và cài dependencies](#4-clone-code-và-cài-dependencies)
5. [Tạo file .env.local](#5-tạo-file-envlocal)
6. [Lấy Gemini API Key](#6-lấy-gemini-api-key)
7. [Khởi động PostgreSQL](#7-khởi-động-postgresql)
8. [Chạy database migrations](#8-chạy-database-migrations)
9. [Khởi động dev server](#9-khởi-động-dev-server)
10. [Kiểm tra port và xử lý conflict](#10-kiểm-tra-port-và-xử-lý-conflict)
11. [Lệnh hàng ngày](#11-lệnh-hàng-ngày)
12. [Xử lý lỗi thường gặp](#12-xử-lý-lỗi-thường-gặp)

---

## 1. Yêu cầu hệ thống

Mở **PowerShell** (Windows Terminal hoặc PowerShell 5.1+) và chạy từng lệnh kiểm tra:

```powershell
# Kiểm tra Node.js (cần >= 18)
node --version
# Mong đợi: v18.x.x hoặc cao hơn (v22.x.x là tốt nhất)

# Kiểm tra npm
npm --version
# Mong đợi: 9.x.x hoặc cao hơn

# Kiểm tra Git
git --version
# Mong đợi: git version 2.x.x
```

**Chưa có Node.js?** Tải tại https://nodejs.org — chọn bản LTS, cài xong khởi động lại máy.  
**Chưa có Git?** Tải tại https://git-scm.com/downloads

---

## 2. Cài đặt Docker Desktop

1. Tải Docker Desktop tại: https://www.docker.com/products/docker-desktop
2. Chạy installer, chọn **"Use WSL 2 instead of Hyper-V"** (nếu được hỏi)
3. **Khởi động lại máy** sau khi cài xong
4. Mở **Docker Desktop** từ Start Menu — chờ đến khi icon dưới taskbar chuyển sang màu xanh/trắng (trạng thái Running)

Kiểm tra Docker đã chạy:

```powershell
docker --version
# Mong đợi: Docker version 24.x.x hoặc cao hơn
```

> **Nếu thấy lỗi `docker is not recognized`** → xem [Bước 3](#3-fix-docker-path-trên-windows)

---

## 3. Fix Docker PATH trên Windows

Sau khi cài Docker Desktop, Windows đôi khi không tự thêm Docker vào PATH của PowerShell.

**Kiểm tra xem Docker có trong PATH chưa:**

```powershell
Get-Command docker -ErrorAction SilentlyContinue
# Nếu không có output → cần fix PATH
```

**Fix vĩnh viễn (chạy 1 lần):**

```powershell
# Kiểm tra Docker Desktop có ở đây không
Test-Path "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
# Phải trả về: True

# Thêm vào PATH của user (không cần quyền admin)
$dockerPath = "C:\Program Files\Docker\Docker\resources\bin"
$currentPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
[System.Environment]::SetEnvironmentVariable("Path", "$currentPath;$dockerPath", "User")

Write-Host "Done. Mo terminal moi de PATH co hieu luc."
```

**Mở terminal mới** rồi kiểm tra lại:

```powershell
docker --version
docker compose version
# Cả hai đều phải hiện version
```

---

## 4. Clone code và cài dependencies

```powershell
# Clone repo
git clone https://github.com/your-username/learnforge.git
cd learnforge

# Kiểm tra đang ở đúng thư mục
Get-ChildItem
# Phải thấy: package.json, prisma/, app/, docker-compose.yml, ...
```

### Cài npm dependencies

> **Lưu ý:** npm 11.x có bug với Prisma preinstall script — dùng `--ignore-scripts` để tránh.

```powershell
npm install --ignore-scripts
```

Chờ 1–3 phút. Kết thúc thành công trông như này:
```
added 848 packages, and audited 849 packages in 32s
```

Nếu thấy `npm error` (không phải `npm warn`) → xem [lỗi npm install](#lỗi-npm-install-err_invalid_arg_type).

Sau đó generate Prisma client:

```powershell
npx prisma generate
# Mong đợi: ✔ Generated Prisma Client (v5.x.x) to .\node_modules\@prisma\client
```

---

## 5. Tạo file .env.local

```powershell
# Tạo .env.local từ template
Copy-Item .env.example .env.local
```

**Generate các secret bắt buộc:**

```powershell
# Tạo AUTH_SECRET
node -e "console.log('AUTH_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"

# Tạo ENCRYPTION_SECRET
node -e "console.log('ENCRYPTION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

Sao chép từng giá trị output vào file `.env.local`.

**Mở file để chỉnh sửa:**

```powershell
notepad .env.local
# Hoặc dùng VS Code:
code .env.local
```

**Điền các giá trị tối thiểu sau vào `.env.local`:**

```env
# Database (dùng đúng port 5433 cho Docker local)
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/learnforge"

# Auth — dán output của lệnh generate ở trên
AUTH_SECRET="<output node -e crypto...>"
NEXTAUTH_URL="http://localhost:3000"

# Encryption — dán output của lệnh generate ở trên
ENCRYPTION_SECRET="<output node -e crypto hex...>"

# AI Provider
AI_PROVIDER="gemini"
GEMINI_API_KEY="<xem Bước 6>"
GEMINI_MODEL="gemini-2.5-flash"
GEMINI_EMBEDDING_MODEL="gemini-embedding-002"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
STORAGE_PROVIDER="local"
UPLOAD_DIR="./uploads"
```

> **Lưu ý port:** Docker PostgreSQL chạy ở `5433` (không phải `5432` mặc định) để tránh conflict với PostgreSQL cài local.

---

## 6. Lấy Gemini API Key

1. Truy cập https://aistudio.google.com/apikey
2. Đăng nhập bằng tài khoản Google
3. Nhấn **"Create API Key"**
4. Sao chép key (bắt đầu bằng `AIzaSy...`)
5. Dán vào `.env.local`:
   ```env
   GEMINI_API_KEY="AIzaSy_your_key_here"
   ```

**Model được khuyên dùng:**

```env
GEMINI_MODEL="gemini-2.5-flash"
GEMINI_EMBEDDING_MODEL="gemini-embedding-002"
```

> Key Gemini miễn phí có giới hạn request/phút. Nếu bị lỗi 429, chờ vài giây và thử lại.

---

## 7. Khởi động PostgreSQL

```powershell
# Khởi động container PostgreSQL (chạy ngầm)
docker compose up -d
```

**Kiểm tra container đang chạy:**

```powershell
docker compose ps
```

Phải thấy output tương tự:
```
NAME                         STATUS              PORTS
learn-forge-app-postgres-1   Up X minutes (healthy)   0.0.0.0:5433->5432/tcp
```

Cột `STATUS` phải là `healthy`, không phải `starting` hoặc `unhealthy`.

**Nếu status vẫn là `starting` sau 30 giây:**

```powershell
# Xem log của container để debug
docker compose logs postgres
```

**Kiểm tra port 5433 đang được lắng nghe:**

```powershell
Get-NetTCPConnection -LocalPort 5433 -State Listen
# Phải thấy một dòng với LocalPort = 5433
```

**Kiểm tra kết nối vào database:**

```powershell
# Dùng psql bên trong container
docker exec -it learn-forge-app-postgres-1 psql -U postgres -c "\l"
# Phải thấy list databases, có "learnforge" nếu migration đã chạy
```

---

## 8. Chạy database migrations

```powershell
npx prisma migrate dev
```

Lần đầu chạy sẽ apply tất cả migrations có sẵn. Output cuối phải là:
```
Your database is now in sync with your schema.
✔ Generated Prisma Client
```

**Kiểm tra tables đã được tạo:**

```powershell
docker exec -it learn-forge-app-postgres-1 psql -U postgres -d learnforge -c "\dt"
# Phải thấy danh sách tables: User, Course, Chapter, Lesson, Exercise,...
```

> Nếu thấy lỗi `Can't reach database server` → container PostgreSQL chưa healthy, quay lại Bước 7.

---

## 9. Khởi động dev server

```powershell
npm run dev
```

Sau 5–10 giây thấy:
```
▲ Next.js 14.x.x
- Local: http://localhost:3000
✓ Ready in Xs
```

**Mở trình duyệt vào: http://localhost:3000**

Trang đăng nhập của LearnForge sẽ hiện ra.

**Kiểm tra server bằng PowerShell:**

```powershell
Invoke-WebRequest "http://localhost:3000" -UseBasicParsing | Select-Object StatusCode
# Mong đợi: StatusCode = 200
```

> **Nếu `npm run dev` lỗi ngay lập tức** → thử `npx next dev` thay thế (xem [xử lý lỗi](#npm-run-dev-exit-ngay-lập-tức))

---

## 10. Kiểm tra port và xử lý conflict

### Kiểm tra port nào đang được dùng

```powershell
# Kiểm tra port 3000 (Next.js)
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue

# Kiểm tra port 5433 (PostgreSQL)
Get-NetTCPConnection -LocalPort 5433 -State Listen -ErrorAction SilentlyContinue

# Xem tất cả port đang listen
Get-NetTCPConnection -State Listen | Select-Object LocalAddress, LocalPort | Sort-Object LocalPort
```

### Tìm process đang chiếm port 3000

```powershell
$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    Get-Process -Id $conn.OwningProcess | Select-Object Id, ProcessName, CPU, StartTime
} else {
    "Port 3000 is free."
}
```

### Kill process chiếm port 3000

```powershell
$pid3000 = (Get-NetTCPConnection -LocalPort 3000 -State Listen).OwningProcess
Stop-Process -Id $pid3000 -Force
Write-Host "Killed process $pid3000 on port 3000"
```

### Next.js tự dùng port khác khi 3000 bị chiếm

Nếu thấy trong output:
```
⚠ Port 3000 is in use, trying 3001 instead.
- Local: http://localhost:3001
```
→ Truy cập `http://localhost:3001` hoặc kill process trên 3000 rồi restart.

---

## 11. Lệnh hàng ngày

### Buổi sáng — bắt đầu làm việc

```powershell
# 1. Vào thư mục project
cd path\to\learnforge

# 2. Kiểm tra Docker có chạy chưa
docker compose ps

# 3. Nếu postgres chưa chạy, khởi động
docker compose up -d

# 4. Chạy app
npm run dev
```

### Tắt server

```powershell
# Ctrl+C trong terminal đang chạy npm run dev

# Tắt PostgreSQL (tùy chọn — giữ chạy tiết kiệm thời gian hôm sau)
docker compose down

# Tắt nhưng GIỮ data
docker compose stop
```

### Xem log PostgreSQL

```powershell
docker compose logs postgres -f
```

### Xem trạng thái database

```powershell
# Mở Prisma Studio (UI trực quan để xem data)
npx prisma studio
# Mở trình duyệt tại http://localhost:5555
```

### Reset database (xóa toàn bộ data, tạo lại từ đầu)

```powershell
npx prisma migrate reset
# Xác nhận bằng cách gõ y rồi Enter
```

---

## 12. Xử lý lỗi thường gặp

### `docker is not recognized`

Docker Desktop chưa chạy hoặc chưa có trong PATH.

```powershell
# Bước 1: Kiểm tra Docker Desktop có cài không
Test-Path "C:\Program Files\Docker\Docker\resources\bin\docker.exe"

# Bước 2: Nếu True, thêm vào PATH tạm cho session này
$env:Path += ";C:\Program Files\Docker\Docker\resources\bin"
docker --version

# Bước 3: Fix vĩnh viễn (xem Bước 3 của hướng dẫn)
```

---

### Lỗi npm install: `ERR_INVALID_ARG_TYPE`

Bug của npm 11.x với Prisma preinstall script.

```powershell
# Thay vì: npm install
# Dùng:
npm install --ignore-scripts

# Sau đó generate Prisma client thủ công
npx prisma generate
```

---

### `Can't reach database server at localhost:5433`

PostgreSQL chưa chạy hoặc chưa healthy.

```powershell
# Kiểm tra container
docker compose ps

# Nếu không thấy container, khởi động
docker compose up -d

# Nếu thấy "unhealthy", xem log
docker compose logs postgres

# Chờ healthy rồi thử lại migration
```

---

### `npm run dev` exit ngay lập tức

Prisma client chưa được generate (do đã cài với `--ignore-scripts`).

```powershell
# Generate client
npx prisma generate

# Thử lại
npm run dev

# Nếu vẫn lỗi, thử trực tiếp
npx next dev
```

---

### Port 3000 bị chiếm khi restart

Server cũ chưa tắt hoàn toàn.

```powershell
# Tìm và kill process
$pid3000 = (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).OwningProcess
if ($pid3000) { Stop-Process -Id $pid3000 -Force; "Killed." } else { "Port 3000 is free." }

# Khởi động lại
npm run dev
```

---

### Gemini API trả về lỗi 429 (Too Many Requests)

Vượt rate limit của free tier.

- Chờ 60 giây rồi thử lại
- Hoặc tạo API key mới tại https://aistudio.google.com/apikey
- Hoặc upgrade lên Gemini paid tier

---

### Prisma schema out of sync

Có migration mới trong code nhưng database chưa được update.

```powershell
npx prisma migrate dev
```

---

## Tóm tắt nhanh (cheat sheet)

| Tình huống | Lệnh |
|---|---|
| Lần đầu setup | `npm install --ignore-scripts` → `npx prisma generate` |
| Start mỗi ngày | `docker compose up -d` → `npm run dev` |
| Xem DB trực quan | `npx prisma studio` |
| Tắt mọi thứ | Ctrl+C → `docker compose stop` |
| Reset DB | `npx prisma migrate reset` |
| Kiểm tra port | `Get-NetTCPConnection -LocalPort 3000 -State Listen` |
| Kill port 3000 | `Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000 -State Listen).OwningProcess -Force` |
| Xem Docker log | `docker compose logs postgres -f` |
| Docker không nhận | `$env:Path += ";C:\Program Files\Docker\Docker\resources\bin"` |
