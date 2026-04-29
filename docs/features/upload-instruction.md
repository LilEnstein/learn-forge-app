# Upload Tài Liệu — Implementation Guide

> Tính năng: người dùng upload tối thiểu 3 file để tạo course.
> Stack: Next.js 14 App Router · Prisma · pgvector · OpenAI / Ollama · pg-boss

---

## Tổng quan luồng

```
User chọn file(s)
    ↓
POST /api/upload          ← multipart/form-data
    ↓
Lưu file vào disk / blob
    ↓
Tạo Document record (status: "processing")
    ↓
Enqueue background job (pg-boss)
    ↓
Worker: parse → chunk → embed → lưu pgvector
    ↓
Document status → "ready"
    ↓
Khi tất cả docs "ready" → trigger curriculum generation
```

---

## Các file cần tạo (tối thiểu 3 file)

```
lib/upload/
├── ingest.ts          ← File 1: toàn bộ RAG pipeline
├── parser.ts          ← File 2: parse PDF / DOCX / TXT
└── chunker.ts         ← File 3: chia văn bản thành chunks

app/api/upload/
└── route.ts           ← API endpoint nhận file

app/api/upload/status/
└── [docId]/route.ts   ← Polling status

components/upload/
└── DropZone.tsx       ← UI upload
```

---

## File 1 — `lib/upload/parser.ts`

Chịu trách nhiệm đọc file thô → trả về plain text.

```typescript
// lib/upload/parser.ts
import fs from "fs/promises"
import path from "path"

export type ParsedDocument = {
  text: string
  metadata: {
    pageCount?: number
    title?: string
    author?: string
  }
}

/**
 * Parse file từ đường dẫn local → plain text
 * Hỗ trợ: .pdf, .docx, .txt, .md
 */
export async function parseFile(
  filePath: string,
  mimeType: string
): Promise<ParsedDocument> {
  const ext = path.extname(filePath).toLowerCase()

  switch (ext) {
    case ".pdf":
      return parsePdf(filePath)
    case ".docx":
      return parseDocx(filePath)
    case ".txt":
    case ".md":
      return parsePlainText(filePath)
    default:
      throw new Error(`Unsupported file type: ${ext}`)
  }
}

// ── PDF ──────────────────────────────────────────────────────────
// npm install pdf-parse
async function parsePdf(filePath: string): Promise<ParsedDocument> {
  const pdfParse = (await import("pdf-parse")).default
  const buffer = await fs.readFile(filePath)
  const data = await pdfParse(buffer)

  return {
    text: data.text,
    metadata: {
      pageCount: data.numpages,
      title: data.info?.Title || undefined,
      author: data.info?.Author || undefined,
    },
  }
}

// ── DOCX ─────────────────────────────────────────────────────────
// npm install mammoth
async function parseDocx(filePath: string): Promise<ParsedDocument> {
  const mammoth = await import("mammoth")
  const result = await mammoth.extractRawText({ path: filePath })

  return {
    text: result.value,
    metadata: {},
  }
}

// ── Plain text / Markdown ─────────────────────────────────────────
async function parsePlainText(filePath: string): Promise<ParsedDocument> {
  const text = await fs.readFile(filePath, "utf-8")
  return { text, metadata: {} }
}
```

**Cài packages:**
```bash
npm install pdf-parse mammoth
npm install -D @types/pdf-parse
```

---

## File 2 — `lib/upload/chunker.ts`

Chia text dài thành các đoạn nhỏ phù hợp để embed.

```typescript
// lib/upload/chunker.ts

export type TextChunk = {
  content: string
  index: number        // thứ tự chunk trong document
  charStart: number    // vị trí bắt đầu trong text gốc
  charEnd: number      // vị trí kết thúc
}

const DEFAULT_CHUNK_SIZE = 1200    // ký tự (~300-400 tokens)
const DEFAULT_OVERLAP    = 150     // ký tự overlap giữa các chunk

/**
 * Sliding window chunker
 * Ưu tiên cắt tại ranh giới đoạn văn (\n\n), câu (. ? !), rồi mới cắt cứng
 */
export function chunkText(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_OVERLAP
): TextChunk[] {
  // Normalize whitespace
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  if (normalized.length === 0) return []

  const chunks: TextChunk[] = []
  let start = 0
  let index = 0

  while (start < normalized.length) {
    let end = start + chunkSize

    if (end >= normalized.length) {
      // Chunk cuối cùng
      chunks.push({
        content: normalized.slice(start).trim(),
        index,
        charStart: start,
        charEnd: normalized.length,
      })
      break
    }

    // Tìm điểm cắt tốt nhất (ưu tiên paragraph > sentence > word)
    end = findBestBreakpoint(normalized, start, end)

    const content = normalized.slice(start, end).trim()
    if (content.length > 0) {
      chunks.push({ content, index, charStart: start, charEnd: end })
      index++
    }

    // Bước tiếp theo: trừ đi overlap để giữ ngữ cảnh
    start = end - overlap
  }

  return chunks
}

function findBestBreakpoint(text: string, start: number, idealEnd: number): number {
  const searchWindow = Math.floor((idealEnd - start) * 0.25) // tìm trong 25% cuối

  // 1. Tìm paragraph break (\n\n)
  const paraBreak = text.lastIndexOf("\n\n", idealEnd)
  if (paraBreak > idealEnd - searchWindow) return paraBreak + 2

  // 2. Tìm sentence break (. ! ?)
  const sentenceBreak = findLastSentenceBreak(text, idealEnd - searchWindow, idealEnd)
  if (sentenceBreak !== -1) return sentenceBreak

  // 3. Tìm word break (space)
  const wordBreak = text.lastIndexOf(" ", idealEnd)
  if (wordBreak > idealEnd - searchWindow) return wordBreak + 1

  // 4. Cắt cứng
  return idealEnd
}

function findLastSentenceBreak(text: string, from: number, to: number): number {
  for (let i = to; i >= from; i--) {
    if ([".", "!", "?", "\n"].includes(text[i]) && text[i + 1] === " ") {
      return i + 2
    }
  }
  return -1
}
```

---

## File 3 — `lib/upload/ingest.ts`

Orchestrate toàn bộ pipeline: parse → chunk → embed → lưu DB.

```typescript
// lib/upload/ingest.ts
import { prisma } from "@/lib/db/prisma"
import { parseFile } from "./parser"
import { chunkText } from "./chunker"
import { getEmbedding } from "@/lib/ai/provider"

/**
 * Entry point cho background worker.
 * Nhận documentId → chạy toàn bộ RAG ingestion pipeline.
 */
export async function ingestDocument(documentId: string): Promise<void> {
  // 1. Load document record từ DB
  const doc = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
  })

  console.log(`[ingest] Starting: ${doc.name} (${doc.id})`)

  try {
    // 2. Parse file → plain text
    const parsed = await parseFile(doc.storagePath, doc.type)
    console.log(`[ingest] Parsed: ${parsed.text.length} chars`)

    if (!parsed.text || parsed.text.trim().length < 100) {
      throw new Error("Document quá ngắn hoặc không đọc được nội dung")
    }

    // 3. Chunk text
    const chunks = chunkText(parsed.text)
    console.log(`[ingest] Chunked: ${chunks.length} chunks`)

    // 4. Embed từng chunk và lưu vào DB
    // Batch 10 chunks một lúc để tránh rate limit
    const BATCH_SIZE = 10
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)

      await Promise.all(
        batch.map(async (chunk) => {
          const embedding = await getEmbedding(chunk.content)

          // Lưu chunk + embedding bằng raw SQL (pgvector chưa support Prisma natively)
          await prisma.$executeRaw`
            INSERT INTO "DocumentChunk" (id, "documentId", content, metadata, embedding)
            VALUES (
              gen_random_uuid(),
              ${doc.id},
              ${chunk.content},
              ${JSON.stringify({ index: chunk.index, charStart: chunk.charStart, charEnd: chunk.charEnd })}::jsonb,
              ${JSON.stringify(embedding)}::vector
            )
          `
        })
      )

      console.log(`[ingest] Embedded batch ${i / BATCH_SIZE + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}`)
    }

    // 5. Cập nhật status → ready
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "ready" },
    })

    console.log(`[ingest] Done: ${doc.name}`)

    // 6. Kiểm tra xem course đã đủ docs "ready" chưa để trigger curriculum
    if (doc.courseId) {
      await checkAndTriggerCurriculum(doc.courseId)
    }

  } catch (error) {
    console.error(`[ingest] Error:`, error)
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "error" },
    })
    throw error
  }
}

/**
 * Nếu tất cả documents của course đều "ready" → trigger sinh curriculum
 */
async function checkAndTriggerCurriculum(courseId: string): Promise<void> {
  const docs = await prisma.document.findMany({
    where: { courseId },
    select: { status: true },
  })

  const allReady = docs.length >= 1 && docs.every((d) => d.status === "ready")

  if (allReady) {
    console.log(`[ingest] All docs ready for course ${courseId}, triggering curriculum...`)
    // Gọi curriculum generation (sẽ implement ở feature sau)
    await prisma.course.update({
      where: { id: courseId },
      data: { status: "generating_curriculum" },
    })
    // TODO: enqueue curriculum job
  }
}
```

---

## File 4 — `lib/ai/provider.ts`

Switch giữa OpenAI và Ollama qua env var.

```typescript
// lib/ai/provider.ts
import OpenAI from "openai"

const provider = process.env.AI_PROVIDER ?? "openai"

// Khởi tạo client một lần
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "ollama", // Ollama không cần key
  baseURL:
    provider === "ollama"
      ? (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434") + "/v1"
      : undefined, // OpenAI dùng default
})

const EMBEDDING_MODEL =
  provider === "ollama"
    ? (process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text")
    : (process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small")

/**
 * Trả về embedding vector cho một đoạn văn bản.
 * Tự động dùng OpenAI hoặc Ollama tùy AI_PROVIDER env.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  // Truncate nếu quá dài (an toàn cho cả hai provider)
  const truncated = text.slice(0, 8000)

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: truncated,
  })

  return response.data[0].embedding
}

export { openai }
```

**Cài packages:**
```bash
npm install openai
```

---

## File 5 — `app/api/upload/route.ts`

API endpoint nhận file từ frontend.

```typescript
// app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/prisma"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import crypto from "crypto"

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads"
const MAX_SIZE_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? "50")
const ALLOWED_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"]
const ALLOWED_EXTS  = [".pdf", ".docx", ".txt", ".md"]

export async function POST(req: NextRequest) {
  // 1. Auth check
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await req.formData()
  const files = formData.getAll("files") as File[]
  const courseId = formData.get("courseId") as string | null

  // 2. Validate
  if (!files || files.length === 0) {
    return NextResponse.json({ error: "Không có file nào được gửi lên" }, { status: 400 })
  }

  // Kiểm tra tối thiểu 3 file khi tạo course mới
  if (!courseId && files.length < 3) {
    return NextResponse.json(
      { error: "Cần ít nhất 3 file để tạo course" },
      { status: 400 }
    )
  }

  const errors: string[] = []
  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase()
    if (!ALLOWED_EXTS.includes(ext)) {
      errors.push(`${file.name}: định dạng không hỗ trợ (chỉ nhận PDF, DOCX, TXT, MD)`)
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      errors.push(`${file.name}: vượt quá ${MAX_SIZE_MB}MB`)
    }
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 })
  }

  // 3. Kiểm tra giới hạn free tier (3 documents)
  const docCount = await prisma.document.count({
    where: { userId: session.user.id },
  })
  const FREE_LIMIT = parseInt(process.env.MAX_DOCUMENTS_FREE ?? "3")
  if (docCount + files.length > FREE_LIMIT) {
    return NextResponse.json(
      { error: `Free tier chỉ cho phép tối đa ${FREE_LIMIT} tài liệu` },
      { status: 403 }
    )
  }

  // 4. Tạo hoặc lấy course
  let resolvedCourseId = courseId
  if (!resolvedCourseId) {
    const courseName = formData.get("courseName") as string ?? "Khóa học mới"
    const topic     = formData.get("topic")      as string ?? "general"

    const course = await prisma.course.create({
      data: {
        userId: session.user.id,
        title: courseName,
        topic,
        status: "processing",
      },
    })
    resolvedCourseId = course.id
  }

  // 5. Lưu từng file và tạo Document record
  await mkdir(UPLOAD_DIR, { recursive: true })

  const createdDocs = await Promise.all(
    files.map(async (file) => {
      const ext      = path.extname(file.name).toLowerCase()
      const fileId   = crypto.randomUUID()
      const fileName = `${fileId}${ext}`
      const filePath = path.join(UPLOAD_DIR, fileName)

      // Ghi file xuống disk
      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(filePath, buffer)

      // Xác định loại document
      const docType = ext === ".pdf" ? "pdf" : ext === ".docx" ? "docx" : "text"

      // Tạo DB record
      const doc = await prisma.document.create({
        data: {
          userId:      session.user.id,
          courseId:    resolvedCourseId,
          name:        file.name,
          type:        docType,
          storagePath: filePath,
          sizeBytes:   file.size,
          status:      "processing",
        },
      })

      return doc
    })
  )

  // 6. Enqueue background ingestion jobs (dùng pg-boss hoặc chạy inline cho dev)
  for (const doc of createdDocs) {
    await enqueueIngest(doc.id)
  }

  return NextResponse.json({
    success: true,
    courseId: resolvedCourseId,
    documents: createdDocs.map((d) => ({ id: d.id, name: d.name, status: d.status })),
  })
}

// ── Background job ────────────────────────────────────────────────
// Dev: chạy inline (không cần pg-boss)
// Prod: dùng pg-boss queue
async function enqueueIngest(documentId: string) {
  if (process.env.NODE_ENV === "production") {
    // TODO: dùng pg-boss
    // await boss.send("ingest-document", { documentId })
  }

  // Dev: chạy luôn (fire & forget, không await để không block response)
  import("@/lib/upload/ingest")
    .then(({ ingestDocument }) => ingestDocument(documentId))
    .catch(console.error)
}
```

---

## File 6 — `app/api/upload/status/[docId]/route.ts`

Polling endpoint để frontend check tiến độ.

```typescript
// app/api/upload/status/[docId]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: { docId: string } }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const doc = await prisma.document.findFirst({
    where: { id: params.docId, userId: session.user.id },
    select: {
      id: true,
      name: true,
      status: true,
      // Đếm số chunks đã embed để hiện progress bar
      _count: { select: { chunks: true } },
    },
  })

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    id:         doc.id,
    name:       doc.name,
    status:     doc.status,      // "processing" | "ready" | "error"
    chunkCount: doc._count.chunks,
  })
}
```

---

## File 7 — `components/upload/DropZone.tsx`

UI upload với drag & drop, hiển thị tiến trình từng file.

```tsx
// components/upload/DropZone.tsx
"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"

type FileStatus = {
  file: File
  status: "pending" | "uploading" | "processing" | "ready" | "error"
  docId?: string
  error?: string
  chunks?: number
}

type Props = {
  courseId?: string         // nếu đã có course → thêm tài liệu vào
  courseName?: string
  topic?: string
  onComplete?: (courseId: string) => void
}

export function DropZone({ courseId, courseName, topic, onComplete }: Props) {
  const [files, setFiles] = useState<FileStatus[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<Record<string, NodeJS.Timeout>>({})
  const router = useRouter()

  const ACCEPTED = ".pdf,.docx,.txt,.md"
  const MIN_FILES = 3

  // ── Drag & Drop ────────────────────────────────────────────────
  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true)  }, [])
  const onDragLeave = useCallback(() => setIsDragging(false), [])
  const onDrop      = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }, [])

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files))
  }, [])

  function addFiles(newFiles: File[]) {
    const valid = newFiles.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? ""
      return ["pdf", "docx", "txt", "md"].includes(ext)
    })
    setFiles((prev) => [
      ...prev,
      ...valid.map((f) => ({ file: f, status: "pending" as const })),
    ])
    setError(null)
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  // ── Upload ────────────────────────────────────────────────────
  async function handleUpload() {
    if (files.length < MIN_FILES) {
      setError(`Cần ít nhất ${MIN_FILES} file để tạo course`)
      return
    }

    setIsUploading(true)
    setError(null)

    const formData = new FormData()
    files.forEach((f) => formData.append("files", f.file))
    if (courseId)   formData.append("courseId",   courseId)
    if (courseName) formData.append("courseName", courseName)
    if (topic)      formData.append("topic",      topic)

    // Đánh dấu tất cả đang uploading
    setFiles((prev) => prev.map((f) => ({ ...f, status: "uploading" })))

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Upload thất bại")
        setFiles((prev) => prev.map((f) => ({ ...f, status: "error" })))
        setIsUploading(false)
        return
      }

      // Map docId vào từng file theo thứ tự
      setFiles((prev) =>
        prev.map((f, i) => ({
          ...f,
          status: "processing",
          docId: data.documents[i]?.id,
        }))
      )

      // Bắt đầu polling status từng doc
      data.documents.forEach((doc: { id: string }) => {
        startPolling(doc.id, data.courseId, onComplete)
      })

    } catch {
      setError("Lỗi kết nối, thử lại nhé")
      setIsUploading(false)
    }
  }

  // ── Polling ───────────────────────────────────────────────────
  function startPolling(docId: string, resolvedCourseId: string, onDone?: (id: string) => void) {
    pollingRef.current[docId] = setInterval(async () => {
      try {
        const res  = await fetch(`/api/upload/status/${docId}`)
        const data = await res.json()

        setFiles((prev) =>
          prev.map((f) =>
            f.docId === docId
              ? { ...f, status: data.status, chunks: data.chunkCount }
              : f
          )
        )

        if (data.status === "ready" || data.status === "error") {
          clearInterval(pollingRef.current[docId])
          delete pollingRef.current[docId]

          // Nếu tất cả docs xong → callback
          setFiles((current) => {
            const allDone = current.every(
              (f) => f.status === "ready" || f.status === "error"
            )
            if (allDone) {
              setIsUploading(false)
              onDone?.(resolvedCourseId)
              router.push(`/learn/${resolvedCourseId}`)
            }
            return current
          })
        }
      } catch {
        // Bỏ qua lỗi polling tạm thời
      }
    }, 2000) // poll mỗi 2 giây
  }

  // ── Render ────────────────────────────────────────────────────
  const pendingCount = files.filter((f) => f.status === "pending").length
  const readyCount   = files.filter((f) => f.status === "ready").length

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`
          border-2 border-dashed rounded-xl p-10 text-center cursor-pointer
          transition-colors duration-150
          ${isDragging
            ? "border-violet-500 bg-violet-50"
            : "border-gray-200 hover:border-violet-400 hover:bg-gray-50"
          }
        `}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={onFileInput}
        />
        <div className="text-4xl mb-3">📁</div>
        <p className="text-sm font-medium text-gray-700">
          Kéo thả file vào đây hoặc <span className="text-violet-600">click để chọn</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Hỗ trợ PDF, DOCX, TXT, MD · Tối đa 50MB/file · Cần ít nhất 3 file
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <FileRow
              key={i}
              fileStatus={f}
              onRemove={() => removeFile(i)}
              disabled={isUploading}
            />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
      )}

      {/* Min files warning */}
      {files.length > 0 && files.length < MIN_FILES && !isUploading && (
        <p className="text-xs text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
          ⚠️ Cần thêm {MIN_FILES - files.length} file nữa để tạo course
        </p>
      )}

      {/* Upload button */}
      {files.some((f) => f.status === "pending") && (
        <button
          onClick={handleUpload}
          disabled={files.length < MIN_FILES || isUploading}
          className="w-full py-3 rounded-xl font-medium text-sm transition-colors
            bg-violet-600 text-white hover:bg-violet-700
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isUploading
            ? `Đang xử lý... (${readyCount}/${files.length} xong)`
            : `Tạo course từ ${files.length} tài liệu`
          }
        </button>
      )}

      {/* All done */}
      {readyCount === files.length && files.length >= MIN_FILES && (
        <div className="text-center py-3 text-sm text-green-700 bg-green-50 rounded-xl">
          ✅ Tất cả tài liệu đã xử lý xong! Đang chuyển đến course...
        </div>
      )}
    </div>
  )
}

// ── File Row component ──────────────────────────────────────────
function FileRow({
  fileStatus,
  onRemove,
  disabled,
}: {
  fileStatus: FileStatus
  onRemove: () => void
  disabled: boolean
}) {
  const { file, status, chunks, error } = fileStatus

  const statusConfig = {
    pending:    { icon: "📄", color: "text-gray-500",  label: "Chờ upload"  },
    uploading:  { icon: "⬆️", color: "text-blue-500",  label: "Đang upload" },
    processing: { icon: "⚙️", color: "text-amber-500", label: chunks ? `Đã tạo ${chunks} chunks` : "Đang xử lý..." },
    ready:      { icon: "✅", color: "text-green-600", label: "Sẵn sàng"    },
    error:      { icon: "❌", color: "text-red-500",   label: error ?? "Lỗi" },
  }

  const cfg = statusConfig[status]

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-white">
      <span className="text-xl">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
        <p className={`text-xs ${cfg.color}`}>{cfg.label}</p>
      </div>
      <span className="text-xs text-gray-400">
        {(file.size / 1024 / 1024).toFixed(1)}MB
      </span>
      {!disabled && status === "pending" && (
        <button
          onClick={onRemove}
          className="text-gray-300 hover:text-red-400 text-lg leading-none"
        >
          ×
        </button>
      )}
    </div>
  )
}
```

---

## Setup: Kích hoạt pgvector

Chạy một lần sau khi `prisma migrate dev`:

```sql
-- Trong psql hoặc thêm vào migration file
CREATE EXTENSION IF NOT EXISTS vector;
```

Hoặc thêm vào file migration đầu tiên:

```sql
-- prisma/migrations/0001_init/migration.sql
-- Thêm dòng này vào đầu file:
CREATE EXTENSION IF NOT EXISTS "vector";
```

---

## Prisma schema cho DocumentChunk (với pgvector)

```prisma
// prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector"), pgcrypto]
}

model DocumentChunk {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  documentId String
  content    String
  metadata   Json     @default("{}")
  embedding  Unsupported("vector(1536)")?

  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
}
```

---

## Tổng kết — Checklist

```
Packages cần cài:
  npm install pdf-parse mammoth openai
  npm install -D @types/pdf-parse

Files cần tạo (7 file):
  ✅ lib/upload/parser.ts          ← parse PDF/DOCX/TXT
  ✅ lib/upload/chunker.ts         ← sliding window chunker
  ✅ lib/upload/ingest.ts          ← RAG pipeline orchestrator
  ✅ lib/ai/provider.ts            ← OpenAI / Ollama switcher
  ✅ app/api/upload/route.ts       ← POST endpoint nhận file
  ✅ app/api/upload/status/[docId]/route.ts  ← GET polling
  ✅ components/upload/DropZone.tsx ← UI drag & drop

Env vars cần có:
  DATABASE_URL
  AI_PROVIDER         = "openai" | "ollama"
  OPENAI_API_KEY      (nếu dùng OpenAI)
  OLLAMA_BASE_URL     (nếu dùng Ollama, mặc định http://localhost:11434)
  UPLOAD_DIR          = "./uploads"
  MAX_UPLOAD_SIZE_MB  = "50"
  MAX_DOCUMENTS_FREE  = "9"   ← 3 course × 3 file

Dùng Ollama (hoàn toàn local, miễn phí):
  ollama pull nomic-embed-text   ← embedding
  ollama pull llama3.1           ← LLM cho curriculum
  # Set AI_PROVIDER=ollama trong .env.local
```
