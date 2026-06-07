# Plan — Feature 13: MarkItDown Document Parsing Layer

> Đọc `spec-feature-13-markitdown-parser.md` trước. Mỗi step có verify riêng — dừng và kiểm tra trước khi sang step kế. Commit theo từng step.

## Prerequisites
- Feature 02 (Upload & RAG) đang chạy: upload → `ingestDocument` → `DocumentChunk`.
- Feature 11 (Realtime Progress) đã có `progressEmitter` + `emit()` trong `ingest.ts`.
- Python ≥ 3.10 trên máy dev (hiện có 3.11.0 ✓).
- **Không** thêm package npm.

---

## Success Criteria (toàn feature)
1. Có markitdown trên máy → các đuôi mới (pptx/xlsx/html…) parse được; docx đi qua MarkItDown.
2. Không có markitdown / `MARKITDOWN_ENABLED=false` / `VERCEL=1` → pipeline cũ chạy y nguyên, **không regression**.
3. Lỗi/timeout/output nghèo của MarkItDown → tự fallback `parseBuffer()`, document vẫn `ready` nếu parser gốc xử lý được.
4. `npm run test` và `npm run build` xanh.

---

## Implementation Steps

### Step 0 — Cài & xác minh markitdown (môi trường dev)
- [ ] `pip install "markitdown[all]"`
- [ ] Verify: `markitdown --version` → in version, exit 0.
- [ ] Verify thủ công CLI đọc stdin:
  - PowerShell: `Get-Content sample.docx -Raw -Encoding Byte | markitdown -x .docx -` (hoặc đơn giản `markitdown sample.docx`) → in Markdown.
- [ ] Tạo `docs/setup/MARKITDOWN-SETUP.md` ghi lại bước cài (Python version, `markitdown[all]`, lưu ý Windows PATH).

**Verify:** lệnh `markitdown --version` chạy được từ terminal cùng shell mà `next dev` dùng.

---

### Step 1 — Thêm biến môi trường
- [ ] Thêm vào `.env.example` và `.env.local`:
  ```bash
  MARKITDOWN_ENABLED="true"
  MARKITDOWN_BIN="markitdown"
  MARKITDOWN_TIMEOUT_MS="60000"
  ```

**Verify:** `process.env.MARKITDOWN_ENABLED` đọc được trong một log tạm ở dev (xoá log sau).

---

### Step 2 — Module `lib/upload/markitdown.ts`
- [ ] Tạo file với 2 export:

```ts
import { spawn } from "node:child_process";

const BIN = process.env.MARKITDOWN_BIN ?? "markitdown";
const TIMEOUT_MS = Number(process.env.MARKITDOWN_TIMEOUT_MS ?? 60000);

let availabilityCache: boolean | null = null;

/** True chỉ khi: không bị tắt, không phải Vercel, và `markitdown --version` chạy được. Cache trong process. */
export async function isMarkItDownAvailable(): Promise<boolean> {
  if (availabilityCache !== null) return availabilityCache;

  if (process.env.MARKITDOWN_ENABLED === "false") return (availabilityCache = false);
  if (process.env.VERCEL === "1") return (availabilityCache = false); // serverless: không có Python

  availabilityCache = await new Promise<boolean>((resolve) => {
    try {
      const p = spawn(BIN, ["--version"]);
      p.on("error", () => resolve(false));      // binary không tồn tại
      p.on("close", (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
  return availabilityCache;
}

/**
 * Convert buffer → Markdown qua `markitdown - ` (stdin → stdout).
 * Trả null cho MỌI lỗi (caller sẽ fallback). Không throw.
 */
export async function convertWithMarkItDown(
  buffer: Buffer,
  fileName: string
): Promise<string | null> {
  const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
  const args = ext ? ["-x", ext, "-"] : ["-"];

  return new Promise<string | null>((resolve) => {
    let stdout = "";
    let settled = false;
    const done = (val: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(val);
    };

    let child;
    try {
      child = spawn(BIN, args);
    } catch {
      return done(null);
    }

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      done(null);
    }, TIMEOUT_MS);

    child.stdout.on("data", (d) => (stdout += d.toString("utf-8")));
    child.on("error", () => done(null));
    child.on("close", (code) => {
      const text = stdout.trim();
      done(code === 0 && text.length > 0 ? text : null);
    });

    child.stdin.on("error", () => done(null)); // EPIPE nếu child chết sớm
    child.stdin.write(buffer);
    child.stdin.end();
  });
}

/** Chỉ dùng cho test: reset cache availability. */
export function __resetMarkItDownCache() {
  availabilityCache = null;
}
```

- [ ] **Không** import gì từ `parser.ts` ở đây — module này độc lập.

**Verify:** viết một script tạm `tsx -e` gọi `convertWithMarkItDown(fs.readFileSync('sample.docx'),'sample.docx')` → in Markdown. Xoá script sau.

---

### Step 3 — Tích hợp vào `ingest.ts` (đường fallback)
File: [lib/upload/ingest.ts](../../lib/upload/ingest.ts)

- [ ] Thêm import:
  ```ts
  import { isMarkItDownAvailable, convertWithMarkItDown } from "./markitdown";
  ```
- [ ] Thay khối parse hiện tại (dòng ~28–40, từ `const parsed = await parseBuffer(...)` tới emit `parse`) bằng:

```ts
let text: string | null = null;
let parserUsed: "markitdown" | "fallback" = "markitdown";

if (await isMarkItDownAvailable()) {
  text = await convertWithMarkItDown(buffer, doc.name);
}

if (!text || text.trim().length < 100) {
  parserUsed = "fallback";
  const parsed = await parseBuffer(buffer, doc.name);
  text = parsed.text;
}

console.log(`[ingest] parsed via ${parserUsed}: ${text.length} chars`);

if (!text || text.trim().length < 100) {
  throw new Error("Document is too short or unreadable");
}

const wordCount = text.split(/\s+/).filter(Boolean).length;
emit(documentId, {
  step: "parse",
  message: `Đã đọc tài liệu (${parserUsed === "markitdown" ? "MarkItDown" : "trình đọc gốc"})`,
  detail: `${wordCount.toLocaleString("vi-VN")} từ`,
  progress: 15,
});
```

- [ ] Cập nhật các dòng dưới dùng `parsed.text` → dùng biến `text` (vd `chunkText(text)` thay `chunkText(parsed.text)`).
- [ ] Giữ nguyên phần còn lại (chunk/embed/curriculum/emit khác) — **không đụng tới**.

**Verify (regression — quan trọng nhất):**
1. Đặt tạm `MARKITDOWN_ENABLED="false"` → upload 1 PDF cũ → log `parsed via fallback` → document `ready`, chunks tạo như trước.
2. Bỏ `MARKITDOWN_ENABLED` (bật lại) → upload 1 `.pptx` → log `parsed via markitdown` → `ready`.
3. Upload 1 `.docx` → `parsed via markitdown` → `ready`.

---

### Step 4 — Unit test `lib/upload/markitdown.test.ts`
- [ ] Mock `node:child_process` (`vi.mock`), test:
  - `isMarkItDownAvailable()` → false khi `MARKITDOWN_ENABLED="false"`.
  - `isMarkItDownAvailable()` → false khi `process.env.VERCEL="1"`.
  - `isMarkItDownAvailable()` → false khi spawn phát `error` (binary thiếu).
  - `isMarkItDownAvailable()` → true khi `--version` close code 0.
  - `convertWithMarkItDown` → trả string khi stdout có data + code 0.
  - `convertWithMarkItDown` → null khi code ≠ 0.
  - `convertWithMarkItDown` → null khi spawn throw.
  - Gọi `__resetMarkItDownCache()` giữa các test để cache không rò.
- [ ] (Tùy chọn) Một test tích hợp `ingest` xác nhận: khi `convertWithMarkItDown` mock trả `null`, `parseBuffer` được gọi (fallback).

**Verify:** `npm run test` → toàn bộ test mới xanh.

---

### Step 5 — Build & smoke cuối
- [ ] `npm run build` → không lỗi type/compile (đảm bảo `child_process` import không phá bundle; module chỉ chạy server-side trong `ingest.ts`).
- [ ] Smoke dev: upload lần lượt `.pdf`, `.docx`, `.pptx`, `.html` → tất cả tới `ready`; kiểm tra SSE log hiển thị parser đã dùng.
- [ ] Kiểm tra DB: `DocumentChunk` có rows cho mỗi document trên.

**Verify:** 4/4 upload `ready`; log parser đúng; chunks tồn tại.

---

## Commit Plan
```
feat(parser): add markitdown availability + convert module (lib/upload/markitdown.ts)
feat(ingest): route parsing through markitdown with parseBuffer fallback
test(parser): cover markitdown availability + fallback paths
docs(setup): add markitdown install guide + env vars
```

---

## Rollback
- Đặt `MARKITDOWN_ENABLED="false"` → tắt hoàn toàn, về luồng cũ ngay, không cần revert code.
- Hoặc `git revert` các commit của feature (bề mặt thay đổi nhỏ, cô lập trong `lib/upload/`).

---

## Lưu ý không-xung-đột (checklist cuối)
- [ ] Không sửa `parser.ts`, `chunker.ts`, schema Prisma, route API.
- [ ] Không thêm dependency npm.
- [ ] Prod (Vercel) hành vi **không đổi** (tự bỏ qua MarkItDown).
- [ ] Mọi lỗi MarkItDown đều fallback, không làm fail document mà parser gốc xử lý được.
- [ ] Gate chất lượng `< 100 ký tự` được bảo toàn (bảo vệ PDF scan qua Gemini).
