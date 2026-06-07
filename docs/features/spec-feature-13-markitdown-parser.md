# Feature 13 — MarkItDown Document Parsing Layer

**Status:** Proposed
**Priority:** Medium
**Milestone:** v0.2
**Relates to:** `lib/upload/parser.ts`, `lib/upload/ingest.ts`, Feature 02 (Upload & RAG), Feature 11 (Realtime Progress)
**External tool:** [microsoft/markitdown](https://github.com/microsoft/markitdown)

---

## 1. Bối cảnh & Vấn đề

Quy trình RAG hiện tại:

```
document → parseBuffer() → chunkText() → embedding → DocumentChunk
```

`parseBuffer()` ([lib/upload/parser.ts](../../lib/upload/parser.ts)) hiện hỗ trợ:

| Type | Parser hiện tại |
|---|---|
| `.pdf` | Gemini Files API (OCR, xử lý PDF scan/phức tạp) |
| `.docx` | mammoth (`extractRawText` → plain text) |
| `.txt` / `.md` | raw UTF-8 |
| khác | **throw `Unsupported file type`** |

**Hạn chế:**
- Chỉ nhận 4 đuôi file. PPTX, XLSX, HTML, CSV, EPUB, ảnh… đều bị từ chối.
- mammoth chỉ trả plain text — mất cấu trúc heading/bảng, làm chunk kém ngữ nghĩa hơn.
- Không có một bước chuẩn hoá "document → Markdown" thống nhất.

**Mục tiêu:**
Thêm một bước **MarkItDown** đứng *trước* parser hiện tại. MarkItDown (Microsoft) chuyển hầu hết định dạng tài liệu → Markdown sạch, giữ heading/bảng/list — định dạng lý tưởng cho chunking + embedding.

```
document → [MarkItDown nếu khả dụng] → chunkText() → embedding → DocumentChunk
                  └── fallback → parseBuffer() (luồng cũ)
```

---

## 2. Ràng buộc Kiến trúc (đọc kỹ trước khi code)

MarkItDown là **thư viện Python** (`pip install markitdown`). LearnForge là **Next.js/TypeScript deploy trên Vercel serverless**, **không chạy được Python in-process**.

**Quyết định thiết kế (đã chốt với chủ dự án):**

1. **Runtime:** MarkItDown chạy bằng cách **spawn CLI Python** qua `child_process` — **chỉ khả dụng ở môi trường có cài Python + markitdown** (máy dev, hoặc container tự host có Python).
2. **Coverage:** **Mọi loại file** đi qua MarkItDown *khi nó khả dụng*.
3. **Fallback bắt buộc:** Khi MarkItDown **không khả dụng** (Vercel prod, chưa cài Python, binary lỗi) **HOẶC** output rỗng/quá ngắn, hệ thống **tự động** quay về `parseBuffer()` cũ.

> ⚠️ **Điều kiện không-xung-đột:** Vì prod (Vercel) không có Python, MarkItDown **không bao giờ là đường đi bắt buộc**. Luồng cũ phải tiếp tục hoạt động y nguyên khi MarkItDown vắng mặt. Đây là yêu cầu cứng — không được để một file đang parse được hôm nay bị fail chỉ vì thêm feature này.

### Sơ đồ

```
┌──────────────────────────────────────────────┐
│ lib/upload/ingest.ts                          │
│   buffer ──> convertWithMarkItDown(buffer,    │
│                                    fileName)  │
│                       │                       │
│            ┌──────────┴───────────┐           │
│         khả dụng?               không/lỗi     │
│            │                        │         │
│            ▼                        ▼         │
│   spawn `markitdown -`      parseBuffer()     │
│   (stdin = buffer)          (Gemini/mammoth/  │
│   stdout = Markdown          raw — luồng cũ)  │
│            │                        │         │
│            └──────────┬─────────────┘         │
│                       ▼                       │
│              text rỗng/<100 ký tự?            │
│                  ──> fallback parseBuffer()   │
│                       │                       │
│                       ▼                       │
│                 chunkText(text)  (không đổi)  │
└──────────────────────────────────────────────┘
```

---

## 3. Phạm vi

### Trong phạm vi
- Module mới `lib/upload/markitdown.ts`: phát hiện khả dụng + spawn CLI + chuẩn hoá output.
- Sửa `lib/upload/ingest.ts`: gọi MarkItDown trước, fallback `parseBuffer()`.
- Một emit progress mới (`parse` step) phản ánh parser nào đã chạy (để khớp Feature 11 SSE log).
- Env flag bật/tắt + đường dẫn binary.
- Unit test cho logic chọn-parser & fallback.

### Ngoài phạm vi (KHÔNG làm trong feature này)
- Không deploy Python microservice (đó là phương án khác đã bị loại).
- Không đổi `chunker.ts`, `retrieve.ts`, schema Prisma, hay curriculum.
- Không gỡ bỏ Gemini/mammoth/raw parser — chúng vẫn là fallback.
- Không xử lý audio-transcription/ảnh-OCR nâng cao của MarkItDown (cần plugin/LLM riêng) — chỉ dùng cấu hình mặc định.

---

## 4. Hành vi chi tiết

### 4.1 Phát hiện khả dụng (availability)

`isMarkItDownAvailable()` trả `true` chỉ khi **tất cả** đúng:

1. `process.env.MARKITDOWN_ENABLED !== "false"` (mặc định bật; đặt `"false"` để tắt cứng).
2. Không phải môi trường serverless không hỗ trợ: nếu `process.env.VERCEL === "1"` → trả `false` ngay (Vercel không có Python). 
3. Lệnh `markitdown --version` (hoặc `MARKITDOWN_BIN`) chạy được, exit code 0.

Kết quả được **cache trong process** (kiểm tra version 1 lần, không spawn lại mỗi document).

### 4.2 Chuyển đổi (convert)

`convertWithMarkItDown(buffer, fileName): Promise<string | null>`:

- Spawn `markitdown -` (đọc từ **stdin**, ghi Markdown ra **stdout**) — không cần ghi file tạm.
  - Lý do dùng stdin/stdout: tránh rác file tạm + race condition; markitdown CLI hỗ trợ `-` cho stdin.
  - Truyền gợi ý phần mở rộng qua `-x <ext>` (vd `-x .pptx`) để markitdown chọn đúng converter khi đọc từ stdin.
- Timeout `MARKITDOWN_TIMEOUT_MS` (mặc định 60000). Quá hạn → kill process → trả `null`.
- Exit code ≠ 0 hoặc stdout rỗng → trả `null`.
- Thành công → trả chuỗi Markdown (đã `trim()`).
- **Mọi lỗi đều nuốt và trả `null`** (không throw) — vì caller sẽ fallback. Không để lỗi MarkItDown làm hỏng cả pipeline.

### 4.3 Tích hợp trong `ingest.ts`

Thay khối parse hiện tại:

```ts
// CŨ:
const parsed = await parseBuffer(buffer, doc.name);
// dùng parsed.text
```

bằng:

```ts
// MỚI:
let text: string | null = null;
let parserUsed = "markitdown";

if (await isMarkItDownAvailable()) {
  text = await convertWithMarkItDown(buffer, doc.name);
}

// Fallback: MarkItDown không khả dụng / lỗi / output quá ngắn
if (!text || text.trim().length < 100) {
  parserUsed = "fallback";
  const parsed = await parseBuffer(buffer, doc.name);
  text = parsed.text;
}

emit(documentId, {
  step: "parse",
  message: `Đã đọc tài liệu (${parserUsed === "markitdown" ? "MarkItDown" : "trình đọc gốc"})`,
  detail: `${wordCount.toLocaleString("vi-VN")} từ`,
  progress: 15,
});
```

> Ngưỡng `< 100 ký tự` giữ nguyên với gate chất lượng đang có ở [ingest.ts](../../lib/upload/ingest.ts) (đoạn `parsed.text.trim().length < 100`). Khi MarkItDown ra kết quả nghèo (vd PDF scan), fallback Gemini sẽ tiếp quản — bảo toàn chất lượng PDF hiện tại.

### 4.4 Định dạng file hỗ trợ (khi MarkItDown khả dụng)

PDF, DOCX, PPTX, XLSX/XLS, HTML/HTM, CSV, JSON, XML, TXT, MD, EPUB, và ảnh (theo cấu hình mặc định markitdown). Khi MarkItDown vắng mặt, tập hỗ trợ thu hẹp về đúng `parseBuffer()` cũ (pdf/docx/txt/md).

---

## 5. Files cần Tạo / Sửa

| File | Loại | Mô tả |
|------|------|------|
| `lib/upload/markitdown.ts` | Tạo mới | `isMarkItDownAvailable()`, `convertWithMarkItDown()` |
| `lib/upload/ingest.ts` | Sửa | Gọi MarkItDown trước `parseBuffer`, fallback, emit `parserUsed` |
| `lib/upload/markitdown.test.ts` | Tạo mới | Test availability + fallback (mock `child_process`) |
| `.env.example` / `.env.local` | Sửa | Thêm env mới (xem §7) |
| `docs/setup/MARKITDOWN-SETUP.md` | Tạo mới | Hướng dẫn `pip install markitdown[all]` |

> **Không** sửa `parser.ts`, `chunker.ts`, schema, hay route nào. Bề mặt thay đổi tối thiểu.

---

## 6. Phụ thuộc

**Python (chỉ môi trường tự host / dev):**
```bash
pip install "markitdown[all]"
# hoặc tối thiểu: pip install markitdown
```
- Yêu cầu Python ≥ 3.10. (Máy dev hiện có Python 3.11.0 ✓)

**Node:** không thêm package npm nào (`child_process` là built-in).

---

## 7. Biến môi trường

```bash
# Bật/tắt bước MarkItDown. "false" = tắt cứng, luôn dùng parser gốc.
MARKITDOWN_ENABLED="true"

# Đường dẫn binary markitdown (nếu không nằm trong PATH).
MARKITDOWN_BIN="markitdown"

# Timeout cho 1 lần convert (ms).
MARKITDOWN_TIMEOUT_MS="60000"
```

> Trên Vercel: **không cần đặt gì** — code tự phát hiện `VERCEL=1` và bỏ qua MarkItDown, dùng parser gốc.

---

## 8. Acceptance Criteria

- [ ] Máy dev có `markitdown`: upload `.pptx`/`.xlsx`/`.html` → ra Markdown → chunk → embed → `DocumentChunk` được tạo (trước đây các đuôi này bị reject).
- [ ] Máy dev có `markitdown`: upload `.docx` → text qua MarkItDown (giữ heading/bảng), pipeline chạy tới `ready`.
- [ ] **Fallback rỗng:** khi `MARKITDOWN_ENABLED="false"` → mọi upload đi đúng luồng `parseBuffer()` cũ, kết quả không đổi so với hiện tại.
- [ ] **Fallback prod:** mô phỏng `VERCEL=1` (không có Python) → MarkItDown bị bỏ qua, PDF vẫn parse qua Gemini như cũ.
- [ ] **Fallback chất lượng:** MarkItDown trả < 100 ký tự cho 1 PDF scan → tự chuyển sang Gemini, document vẫn `ready`.
- [ ] Lỗi MarkItDown (binary crash, timeout) **không** làm document chuyển `error` nếu parser gốc xử lý được.
- [ ] SSE log (Feature 11) hiển thị parser nào đã dùng ("MarkItDown" hoặc "trình đọc gốc").
- [ ] `npm run test` xanh; `npm run build` không lỗi.

---

## 9. Edge Cases

| Case | Xử lý |
|------|------|
| Python/markitdown chưa cài | `isMarkItDownAvailable()` → false (cache) → parser gốc |
| Chạy trên Vercel | `VERCEL=1` → bỏ qua MarkItDown, không spawn |
| PDF scan, MarkItDown ra text nghèo | output < 100 ký tự → fallback Gemini OCR |
| Đuôi file lạ MarkItDown không nhận | exit ≠ 0 → null → `parseBuffer` throw `Unsupported` (hành vi giống hiện tại với type lạ) |
| markitdown treo | timeout → kill → null → fallback |
| Buffer rất lớn qua stdin | dựa timeout + giới hạn upload 50MB (Feature 02) đã chặn ở tầng upload |
| Stderr ồn nhưng exit 0 | bỏ qua stderr, chỉ xét exit code + stdout |

---

## 10. Tham khảo
- [microsoft/markitdown](https://github.com/microsoft/markitdown) — README, CLI usage (`markitdown path` / `markitdown - < file`)
- Feature 02 — `spec-feature-02-upload-rag.md` (pipeline gốc)
- Feature 11 — `feature-11-realtime-upload-progress.md` (SSE progress, `parse` step)
- Spec gốc: `learnforge-app-spec.md` (Upload flow)
