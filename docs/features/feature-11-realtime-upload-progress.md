# Feature 11 — Realtime Upload Progress & Pipeline UX

**Status:** Proposed  
**Priority:** High  
**Milestone:** v0.1 MVP  
**Relates to:** `app/upload/page.tsx`, `lib/ai/rag/ingest.ts`, `components/upload/ProcessingStatus.tsx`

---

## 1. Bối cảnh & Vấn đề

Hiện tại khi user upload tài liệu, pipeline xử lý gồm 5 bước nặng chạy tuần tự:

```
Upload → Parse (pdf/docx) → Chunk → Embed (Gemini API × N) → Generate Curriculum + Exercises
```

**Vấn đề UX:**
- User chỉ thấy spinner chung chung, không biết đang ở bước nào
- Không có ước tính thời gian còn lại
- Nếu lỗi xảy ra ở bước nào, không có thông tin để debug
- Bước embedding gọi API từng chunk một → rất chậm với tài liệu dài

**Mục tiêu của feature này:**
- Hiển thị log realtime từng bước như terminal
- Cho user thấy tiến độ % cụ thể
- Cải thiện tốc độ pipeline ~3–5× thông qua batching và parallelism

---

## 2. Thiết kế Kỹ thuật

### 2.1 Transport: Server-Sent Events (SSE)

Thay polling `/api/upload/status/:docId` bằng SSE stream. Client mở một connection, server push event khi có cập nhật mới.

**Lý do chọn SSE thay WebSocket:**
- One-way (server → client) là đủ cho progress log
- Tương thích Vercel Edge Runtime
- Tự reconnect nếu mất kết nối (built-in trong `EventSource` API)
- Không cần thư viện ngoài

### 2.2 Event Schema

```typescript
// types/progress.ts
export type ProgressStep =
  | 'upload'
  | 'parse'
  | 'chunk'
  | 'embed'
  | 'curriculum'
  | 'exercises'
  | 'done'
  | 'error'

export interface ProgressEvent {
  step: ProgressStep
  message: string       // "Đang tạo vector embedding..."
  progress?: number     // 0–100
  detail?: string       // "Chunk 12/47" | "Chương 3/8"
  timestamp: number     // Date.now()
  courseId?: string     // populated khi step === 'done'
}
```

### 2.3 Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser                                            │
│  EventSource('/api/upload/progress/:docId')         │
│         │  onmessage                                │
│         ▼                                           │
│  ProcessingStatus.tsx  ←── renders log + steps      │
└────────────────────┬────────────────────────────────┘
                     │ SSE stream
┌────────────────────▼────────────────────────────────┐
│  Next.js API Route                                  │
│  app/api/upload/progress/[docId]/route.ts           │
│         │  ReadableStream controller                │
│         ▼                                           │
│  ProgressEmitter (singleton Map)                    │
│         ▲  emit(docId, event)                       │
│         │                                           │
│  lib/ai/rag/ingest.ts  ←── pipeline worker          │
└─────────────────────────────────────────────────────┘
```

---

## 3. Files Cần Tạo / Sửa

| File | Loại | Mô tả |
|------|------|-------|
| `types/progress.ts` | Tạo mới | ProgressEvent type definitions |
| `lib/progress-emitter.ts` | Tạo mới | Singleton emitter dùng Map |
| `app/api/upload/progress/[docId]/route.ts` | Tạo mới | SSE endpoint |
| `lib/ai/rag/ingest.ts` | Sửa | Thêm emit calls + batch optimizations |
| `components/upload/ProcessingStatus.tsx` | Sửa | UI mới với terminal log + step indicator |
| `app/(app)/upload/page.tsx` | Sửa | Mount ProcessingStatus sau upload |

---

## 4. Prompt để Implement

### Prompt A — `ProgressEmitter` + SSE Endpoint

```
Tôi đang xây dựng LearnForge (Next.js 14 App Router, TypeScript, Vercel deployment).
Cần tạo SSE progress stream cho pipeline xử lý tài liệu.

Hãy tạo 2 files:

--- FILE 1: lib/progress-emitter.ts ---
Tạo singleton ProgressEmitter với:
- Một Map<docId: string, controller: ReadableStreamDefaultController>
- Method: subscribe(docId) → ReadableStream (tạo stream mới, lưu controller vào Map)
- Method: emit(docId, event: ProgressEvent) → void (gửi SSE message vào stream)
- Method: close(docId) → void (đóng stream và xóa khỏi Map)
- Tự động cleanup nếu controller đã closed khi emit
- Format SSE message đúng chuẩn: "data: {json}\n\n"

--- FILE 2: app/api/upload/progress/[docId]/route.ts ---
GET handler trả về:
- Headers: Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive
- Body: ReadableStream từ progressEmitter.subscribe(docId)
- Cleanup khi request.signal aborts (client disconnect)
- Tương thích Vercel Edge: export const runtime = 'edge' (nếu cần)

Type ProgressEvent đã được define trong types/progress.ts với các fields:
step, message, progress (0-100), detail, timestamp, courseId.
```

---

### Prompt B — Refactor `ingest.ts` (Performance + Emit)

```
Refactor lib/ai/rag/ingest.ts cho LearnForge. File hiện tại xử lý:
parse → chunk → embed → generate curriculum → generate exercises.
Dùng Gemini API (google-generative-ai SDK). Có sẵn progressEmitter từ lib/progress-emitter.ts.

Yêu cầu PERFORMANCE:
1. Batch embedding: gom 20 chunks/batch, dùng Gemini batchEmbedContents thay vì loop đơn.
2. Parallel exercise generation: sau khi có curriculum, dùng Promise.all để generate exercises cho tất cả chapters đồng thời. Giới hạn concurrency tối đa 3 với p-limit để tránh rate limit.
3. Batch DB insert: dùng prisma.documentChunk.createMany() thay vì loop create().
4. Streaming generation: khi gọi Gemini generateContentStream, parse và lưu DB từng object JSON ngay khi stream về.

Yêu cầu EMIT (gọi progressEmitter.emit(docId, event) tại các điểm sau):
- Sau khi save file: { step: 'upload', message: 'Đã lưu tài liệu', progress: 5 }
- Sau khi parse xong: { step: 'parse', message: `Đã đọc tài liệu (${pageCount} trang, ${wordCount} từ)`, progress: 15 }
- Mỗi batch chunk: { step: 'chunk', message: 'Đang chia nhỏ nội dung...', detail: `Chunk ${done}/${total}`, progress: 15 + (done/total)*20 }
- Mỗi batch embed: { step: 'embed', message: 'Đang tạo vector embedding...', detail: `Batch ${i}/${totalBatches}`, progress: 35 + (i/totalBatches)*30 }
- Sau curriculum xong: { step: 'curriculum', message: 'Đã tạo lộ trình học', progress: 70 }
- Sau mỗi chapter exercises: { step: 'exercises', message: 'Đang tạo bài tập...', detail: `Chương ${done}/${total}`, progress: 70 + (done/total)*28 }
- Khi hoàn thành: { step: 'done', message: 'Khóa học đã sẵn sàng!', progress: 100, courseId }
- Khi có lỗi: { step: 'error', message: err.message, progress: undefined }

Giữ nguyên function signature: export async function ingestDocument(docId: string, filePath: string, userId: string)
```

---

### Prompt C — `ProcessingStatus.tsx` Component

```
Tạo component components/upload/ProcessingStatus.tsx cho LearnForge.
Stack: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion.
Nhận props: { docId: string; onComplete: (courseId: string) => void; onError: () => void }

--- STEP INDICATOR (bên trái / trên) ---
Hiển thị 6 bước dạng timeline dọc:
  📄 Đọc tài liệu        (step: 'parse')
  ✂️  Chia nhỏ nội dung   (step: 'chunk')
  🧠 Tạo vector          (step: 'embed')
  🗺️  Sinh lộ trình       (step: 'curriculum')
  📝 Tạo bài tập         (step: 'exercises')
  ✅ Hoàn thành           (step: 'done')

3 states cho mỗi bước:
- pending: icon xám, text mờ
- active: icon màu xanh, text đậm, pulse animation (Framer Motion)
- done: checkmark xanh lá, text strikethrough nhẹ

--- TERMINAL LOG PANEL (bên phải / dưới) ---
- Background: slate-900, font: monospace, rounded-lg
- Mỗi event thêm 1 dòng: "[HH:mm:ss] message  detail"
- Màu theo step: parse=cyan, chunk=yellow, embed=purple, curriculum=blue, exercises=green, error=red
- Dòng mới fade-in từ dưới lên bằng Framer Motion AnimatePresence
- Auto-scroll xuống dòng cuối (useRef + scrollIntoView)
- Hiển thị tối đa 50 dòng log

--- PROGRESS BAR ---
- Full width, bên dưới terminal
- Animate smooth: transition-all duration-500
- Hiển thị % text bên phải

--- STATES ---
- Loading: skeleton nhỏ khi chưa có event
- Done: confetti nhỏ (CSS animation) + nút "Bắt đầu học →" gọi onComplete(courseId)
- Error: text đỏ + nút "Thử lại" gọi onError()

--- LOGIC ---
- Dùng useEffect + EventSource(`/api/upload/progress/${docId}`)
- Cleanup EventSource khi unmount hoặc khi nhận done/error
- Không dùng thư viện ngoài ngoài Framer Motion
```

---

## 5. Acceptance Criteria

- [ ] User thấy log realtime ngay khi upload xong, không cần refresh
- [ ] Mỗi bước pipeline có message tiếng Việt rõ ràng
- [ ] Progress bar tăng liên tục, không nhảy đột ngột
- [ ] Tốc độ embedding nhanh hơn ít nhất 3× so với trước (batch 20 vs 1)
- [ ] Chapters được generate song song (kiểm tra bằng network tab)
- [ ] Disconnect client → không memory leak trên server (controller cleanup)
- [ ] Khi lỗi: hiển thị message lỗi cụ thể + nút thử lại
- [ ] Khi done: tự navigate sang trang learning map của course

---

## 6. Thứ tự Implement

```
1. types/progress.ts                         (không có dependency)
2. lib/progress-emitter.ts                   (cần types)
3. app/api/upload/progress/[docId]/route.ts  (cần emitter)
4. lib/ai/rag/ingest.ts  (refactor)          (cần emitter + types)
5. components/upload/ProcessingStatus.tsx    (cần SSE endpoint)
6. app/(app)/upload/page.tsx  (wire up)      (cần component)
```

---

## 7. Edge Cases & Lưu ý

| Case | Xử lý |
|------|-------|
| User đóng tab giữa chừng | `request.signal` abort → cleanup controller → pipeline vẫn tiếp tục chạy ở server |
| Gemini rate limit (429) | Retry với exponential backoff tối đa 3 lần, emit message "Đang thử lại..." |
| File quá lớn (>50MB) | Validate ở upload endpoint, trả lỗi trước khi queue |
| Mất kết nối internet | `EventSource` tự reconnect sau 3s (built-in), server giữ stream 5 phút |
| Nhiều tab mở cùng docId | Map cho phép 1 controller/docId; tab sau sẽ override tab trước |
| Vercel timeout (60s) | Pipeline nặng nên chạy qua `pg-boss` background job (đã có trong spec), SSE stream chờ job updates |

---

## 8. Tham khảo

- [MDN — Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Vercel — Streaming](https://vercel.com/docs/functions/streaming)
- [Gemini — Batch Embed](https://ai.google.dev/api/embeddings#v1beta.models.batchEmbedContents)
- Spec gốc: `learnforge-app-spec.md` §5.4 (Upload flow), §6 (API routes)
