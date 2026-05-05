# Lấy API Keys

Hướng dẫn lấy từng key cần điền vào `.env.local`. Key nào bắt buộc, key nào tùy chọn đều được ghi rõ.

---

## Tóm tắt nhanh

| Biến | Bắt buộc | Dùng để làm gì |
|---|---|---|
| `AUTH_SECRET` | Bắt buộc | Mã hóa session đăng nhập |
| `ENCRYPTION_SECRET` | Bắt buộc | Mã hóa API key người dùng lưu |
| `DATABASE_URL` | Bắt buộc | Kết nối database |
| `GEMINI_API_KEY` | 1 trong 3 | Chạy AI (Gemini — miễn phí) |
| `OPENAI_API_KEY` | 1 trong 3 | Chạy AI (OpenAI — mạnh hơn) |
| `OLLAMA_BASE_URL` | 1 trong 3 | Chạy AI local (không cần internet) |
| `GOOGLE_CLIENT_ID/SECRET` | Tùy chọn | Đăng nhập bằng Google |
| `GITHUB_CLIENT_ID/SECRET` | Tùy chọn | Đăng nhập bằng GitHub |

Bạn chỉ cần **1 trong 3 AI provider**. Gemini là dễ nhất vì có free tier.

---

## AUTH_SECRET — Bắt buộc

**Dùng để làm gì:** Mã hóa cookie phiên đăng nhập. Nếu thiếu, app sẽ không cho đăng nhập.

**Cách lấy:** Tự sinh — không cần đăng ký gì.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy output và paste vào `.env.local`:
```env
AUTH_SECRET="kết-quả-copy-ở-đây"
```

---

## ENCRYPTION_SECRET — Bắt buộc

**Dùng để làm gì:** Mã hóa API key người dùng lưu trong database (tính năng BYOK).

**Cách lấy:** Tự sinh.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```env
ENCRYPTION_SECRET="kết-quả-copy-ở-đây"
```

> Key này phải là 64 ký tự hex. Đừng dùng lại AUTH_SECRET cho biến này.

---

## DATABASE_URL — Bắt buộc

**Dùng để làm gì:** Địa chỉ kết nối database PostgreSQL.

**Local (dùng Docker từ Quickstart):**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/learnforge"
```

**Production (Neon):** Xem [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md#tao-database-tren-neon)

---

## GEMINI_API_KEY — AI Provider (Khuyến nghị cho free tier)

**Dùng để làm gì:** Chạy các tác vụ AI: phân tích tài liệu, tạo khóa học, bài tập, AI companion.

**Free tier:** ~1,500 requests/ngày. Đủ để dùng cá nhân.

**Cách lấy:**

1. Vào https://aistudio.google.com/
2. Đăng nhập bằng tài khoản Google
3. Bấm **"Get API key"** ở menu trái
4. Bấm **"Create API key"** → chọn project hoặc tạo mới
5. Copy key — trông giống như: `AIzaSy...` (bắt đầu bằng `AIzaSy`)

```env
AI_PROVIDER="gemini"
GEMINI_API_KEY="AIzaSy-key-của-bạn"
GEMINI_MODEL="gemini-2.0-flash"
GEMINI_EMBEDDING_MODEL="gemini-embedding-001"
```

**Kiểm tra key hoạt động:**
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSy-key-của-bạn" | head -5
```
Nếu thấy JSON có `"models"` → key hợp lệ.  
Nếu thấy `"API_KEY_INVALID"` → kiểm tra lại đã copy đúng chưa.

**Khi hết quota (lỗi 429):** Đợi đến 8:00 sáng hôm sau hoặc thêm key dự phòng. Xem [BYOK-GUIDE.md](../user/BYOK-GUIDE.md).

---

## OPENAI_API_KEY — AI Provider (Mạnh hơn, có phí)

**Dùng để làm gì:** Dùng GPT-4o thay Gemini. Chất lượng cao hơn, tốn tiền theo lượng dùng.

**Cách lấy:**

1. Vào https://platform.openai.com/
2. Đăng ký hoặc đăng nhập
3. Vào **API keys** (menu trái)
4. Bấm **"Create new secret key"**
5. Copy key — trông giống như: `sk-proj-...`

```env
AI_PROVIDER="openai"
OPENAI_API_KEY="sk-proj-key-của-bạn"
OPENAI_MODEL="gpt-4o"
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
```

> Cần nạp credit trước tại https://platform.openai.com/settings/billing

---

## Ollama — AI Provider (Local, không cần internet)

**Dùng để làm gì:** Chạy LLM ngay trên máy bạn. Không tốn tiền, không cần internet, nhưng cần máy đủ RAM (≥8GB).

**Cách setup:**

1. Tải Ollama: https://ollama.com/download
2. Cài model:
```bash
ollama pull llama3.1
ollama pull nomic-embed-text
```
3. Kiểm tra Ollama đang chạy:
```bash
curl http://localhost:11434/api/tags
```
Thấy JSON có `"models"` → OK.

```env
AI_PROVIDER="ollama"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.1"
OLLAMA_EMBEDDING_MODEL="nomic-embed-text"
```

---

## GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET — Tùy chọn (OAuth Google)

**Dùng để làm gì:** Cho phép user đăng nhập bằng "Đăng nhập với Google" thay vì email/mật khẩu.

**Cách lấy:**

1. Vào https://console.cloud.google.com/
2. Tạo project mới hoặc chọn project có sẵn
3. Vào **APIs & Services → Credentials**
4. Bấm **"+ Create Credentials" → "OAuth client ID"**
5. Application type: **Web application**
6. Thêm vào **Authorized redirect URIs:**
   - `http://localhost:3000/api/auth/callback/google` (local)
   - `https://your-domain.vercel.app/api/auth/callback/google` (production)
7. Bấm **Create** → copy Client ID và Client Secret

```env
GOOGLE_CLIENT_ID="123456789-abc.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-..."
```

---

## GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET — Tùy chọn (OAuth GitHub)

**Dùng để làm gì:** Cho phép user đăng nhập bằng tài khoản GitHub.

**Cách lấy:**

1. Vào https://github.com/settings/developers
2. Bấm **"New OAuth App"**
3. Điền:
   - **Application name:** LearnForge
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`
4. Bấm **"Register application"**
5. Copy **Client ID**, sau đó bấm **"Generate a new client secret"**

```env
GITHUB_CLIENT_ID="Ov23li..."
GITHUB_CLIENT_SECRET="abc123..."
```

---

## Tóm tắt .env.local tối thiểu để chạy local

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/learnforge"

# Auth
AUTH_SECRET="<node -e "...">"
NEXTAUTH_URL="http://localhost:3000"
ENCRYPTION_SECRET="<node -e "...">"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# AI (chọn 1)
AI_PROVIDER="gemini"
GEMINI_API_KEY="AIzaSy..."
GEMINI_MODEL="gemini-2.0-flash"
GEMINI_EMBEDDING_MODEL="gemini-embedding-001"

# Admin (tùy chọn — để trở thành admin)
ADMIN_EMAILS="email-của-bạn@gmail.com"
```
