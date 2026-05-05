# Quản lý API Key Pool

Key pool là các API key admin cung cấp để user trong hệ thống dùng chung. User không cần tự lấy key.

---

## Key pool hoạt động như thế nào

```
User upload tài liệu
  ↓
Hệ thống kiểm tra: user có key cá nhân không?
  ├─ Có → dùng key cá nhân của user
  └─ Không → dùng key từ pool của admin
               ├─ Key active → xử lý bình thường
               └─ Key quota exceeded → thử key tiếp theo trong pool
                    └─ Không còn key nào → trả lỗi "Hệ thống tạm thời không khả dụng"
```

---

## Xem danh sách key trong pool

Admin Dashboard → **"API Keys"** tab.

Mỗi key hiển thị:
- Tên key (do admin đặt)
- Provider (Gemini / OpenAI / ...)
- Trạng thái: `active` / `quota_exceeded` / `invalid`
- Lần dùng gần nhất
- Thời gian reset quota (nếu đang exceeded)

---

## Thêm key vào pool

1. Bấm **"+ Add Pool Key"**
2. Điền:
   - **Tên key** (ví dụ: "Gemini key chính", "OpenAI backup")
   - **Provider**: Gemini, OpenAI, Groq, Cerebras, hoặc OpenAI-compatible
   - **API Key**: paste key vào
3. Bấm **"Verify & Save"**
   - Hệ thống tự kiểm tra key có hợp lệ không
   - Nếu hợp lệ: thấy danh sách model và thông báo thành công
   - Nếu không hợp lệ: thấy thông báo lỗi cụ thể

---

## Xóa key

1. Tìm key trong danh sách
2. Bấm **"⋯"** → **"Remove from pool"**
3. Xác nhận

Key bị xóa ngay lập tức. Các request đang xử lý dở sẽ failover sang key khác.

---

## Theo dõi trạng thái

**Key bị đánh dấu `quota_exceeded` tự động** khi provider trả về lỗi 429.

**Key tự phục hồi** sau ~24h (Gemini) hoặc theo reset schedule của provider.

**Làm key active lại thủ công** (khi biết quota đã reset):
1. Tìm key trạng thái `quota_exceeded`
2. Bấm **"⋯"** → **"Mark as Active"**

---

## Chiến lược key pool hiệu quả

**Dùng nhiều provider:**
```
Pool ví dụ:
- Gemini key 1     (primary, nhiều quota nhất)
- Gemini key 2     (dùng Gmail khác)
- OpenAI key       (fallback, trả phí)
```

**Tách key theo môi trường:**
- Không dùng chung key giữa dev và production
- Tạo key riêng cho từng môi trường

**Monitor quota:**
- Gemini free tier: ~1,500 req/ngày
- Nếu thường xuyên hết quota: thêm key, hoặc khuyến khích user dùng key cá nhân (xem [BYOK-GUIDE.md](../user/BYOK-GUIDE.md))

---

## Khi tất cả key đều hết quota

User sẽ thấy thông báo:
> "Hệ thống đang tạm thời quá tải. Vui lòng thêm API key cá nhân hoặc thử lại sau."

Giải pháp:
1. Thêm key mới vào pool ngay
2. Hoặc hướng dẫn user tự cung cấp key: [BYOK-GUIDE.md](../user/BYOK-GUIDE.md)
