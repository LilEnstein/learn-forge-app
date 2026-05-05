# BYOK — Mang API Key Riêng (Bring Your Own Key)

Hướng dẫn thêm API key cá nhân vào LearnForge để không bị giới hạn quota.

---

## Tại sao cần API key riêng?

LearnForge dùng AI để phân tích tài liệu và tạo bài học. AI cần API key để hoạt động.

Có 2 cách:
1. **Admin cấp** — admin của app đã thêm key vào hệ thống, bạn dùng mà không cần làm gì
2. **Bạn tự cung cấp** — lấy key miễn phí và thêm vào Settings (hướng dẫn bên dưới)

Dùng key riêng có lợi ích:
- Không bị ảnh hưởng khi key pool của admin hết quota
- Chủ động kiểm soát model AI dùng cho từng tác vụ
- Có thể thêm nhiều key dự phòng — tự động failover khi hết quota

---

## Lấy Gemini API Key miễn phí (5 phút)

Gemini là lựa chọn dễ nhất — miễn phí, không cần thẻ tín dụng.

**Free tier:** ~1,500 requests/ngày. Đủ dùng bình thường.

**Cách lấy:**

1. Vào https://aistudio.google.com/
2. Đăng nhập bằng tài khoản Google
3. Bấm **"Get API key"** ở menu trái
4. Bấm **"Create API key"**
5. Chọn project (hoặc tạo mới) → bấm **"Create API key in existing project"**
6. Copy key — trông giống: `AIzaSy...` (39 ký tự)

> Giữ key này bí mật. Không paste lên GitHub, không chia sẻ trong chat.

---

## Thêm key vào LearnForge

1. Đăng nhập vào app
2. Bấm avatar góc dưới trái → **"Settings"**
3. Tìm phần **"My API Keys"** → bấm **"+ Add Key"**
4. Điền vào form:
   - **Tên key** — đặt tên dễ nhớ, ví dụ: `Gemini cá nhân` hoặc `Key Gmail công ty`
   - **Provider** — chọn `Gemini`
   - **API Key** — paste key vừa copy
5. Bấm **"Verify & Save"**
   - Hệ thống tự kiểm tra key có hợp lệ không
   - Nếu hợp lệ: thấy ✅ và danh sách model khả dụng

---

## Thêm nhiều key dự phòng

Nếu key chính hết quota, hệ thống tự chuyển sang key dự phòng.

**Cách thêm key thứ 2:**
- Tạo thêm Gemini key bằng Gmail khác (mỗi Gmail = 1,500 req/ngày)
- Hoặc thêm key từ provider khác: OpenAI, Groq (miễn phí), Cerebras (miễn phí)

**Đặt key mặc định:**
Trong Settings → My API Keys → bấm **"Set as default"** trên key bạn muốn dùng chính.

---

## Lấy Groq API Key miễn phí (thay thế Gemini)

Groq cho phép dùng Llama, Mixtral miễn phí với quota cao.

1. Vào https://console.groq.com/
2. Đăng ký → vào **"API Keys"** → **"Create API Key"**
3. Copy key — trông giống: `gsk_...`

Trong Settings:
- Provider: `Groq`
- Model: `llama-3.3-70b-versatile`

> Groq không có embedding model. Cần thêm Gemini key riêng cho embedding, hoặc dùng Ollama local.

---

## Cấu hình model cho từng tác vụ

Sau khi thêm key, bạn có thể chọn model khác nhau cho từng việc:

Settings → **"Model Configuration"**:

| Tác vụ | Mặc định | Gợi ý |
|---|---|---|
| Xử lý tài liệu | gemini-2.0-flash | gemini-2.5-flash (chính xác hơn) |
| Tạo khóa học | gemini-2.0-flash | gemini-2.5-flash |
| AI Companion chat | gemini-2.0-flash-lite | gemini-2.0-flash-lite (nhanh hơn) |
| Embeddings | gemini-embedding-001 | Không nên đổi |

Bấm **"Save Configuration"** sau khi chọn xong.

---

## Key hết quota phải làm gì

Khi key hết quota, bạn thấy thông báo trên trang Upload:
```
⚠️ Key cá nhân đã hết quota — Reset sau ~5h 42m  [Switch ▼]
```

**Lựa chọn:**
1. **Đợi reset** — Gemini free tier reset lúc 8:00 sáng (giờ UTC+7)
2. **Switch sang key dự phòng** — bấm `[Switch ▼]` → chọn key khác
3. **Thêm key mới** — bấm **"+ Add new key"** trong dropdown

---

## Xóa key

Settings → My API Keys → bấm **"⋯"** → **"Remove"**

Nếu xóa key đang là mặc định, hệ thống tự chọn key tiếp theo làm mặc định. Nếu không còn key nào, hệ thống dùng key pool của admin (nếu có).
