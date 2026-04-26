# Plan — Feature 02: Document Upload & RAG Pipeline

## Prerequisites
- Feature 01 (Auth) complete — upload requires authenticated user
- Postgres + pgvector running (Docker Compose)
- `prisma/schema.prisma` with Document, DocumentChunk models
- Dependencies listed below installed

---

## Implementation Steps

### Step 1 — Prisma schema & migration
- [ ] Add Document, DocumentChunk models to `prisma/schema.prisma`
  - Include `embedding Unsupported("vector(1536)")` on DocumentChunk
  - Add `@@index([documentId])` on DocumentChunk
- [ ] Enable `pgvector` extension in schema datasource
- [ ] Run `npx prisma migrate dev --name add-rag-models`

### Step 2 — Storage layer
- [ ] Create `lib/storage/local.ts`
  - `saveFile(buffer, filename): Promise<string>` — writes to `UPLOAD_DIR`, returns path
  - `deleteFile(path): Promise<void>`
- [ ] Create `lib/storage/vercel-blob.ts`
  - Same interface, uses `@vercel/blob` `put()`
- [ ] Create `lib/storage/index.ts`
  - Exports `storage` instance selected by `STORAGE_PROVIDER` env var

### Step 3 — Upload API route
- [ ] Create `app/api/upload/route.ts` (POST)
  - Auth check (reject if unauthenticated)
  - Parse multipart form data (`formidable` or Next.js native)
  - Validate: file type in allowlist, size ≤ MAX_UPLOAD_SIZE_MB
  - Check free tier limit (`MAX_DOCUMENTS_FREE`)
  - Save file via storage layer
  - `prisma.document.create({ status: "processing", ... })`
  - Enqueue background job (pg-boss) `ingest-document { documentId }`
  - Return `{ documentId }` with `202 Accepted`
- [ ] Create `app/api/upload/status/[docId]/route.ts` (GET)
  - Return `{ status, name, sizeBytes }` for polling

### Step 4 — Text chunker
- [ ] Create `lib/ai/rag/chunker.ts`
  - `chunkText(text: string): Chunk[]`
  - Sliding window: 512 tokens, overlap 64 tokens
  - Use `tiktoken` or approximate by words (~4 chars/token)
  - Each chunk: `{ content, index, metadata: { position } }`

### Step 5 — Parsers
- [ ] Create `lib/ai/rag/parsers/pdf.ts` — wrap `pdf-parse`
- [ ] Create `lib/ai/rag/parsers/docx.ts` — wrap `mammoth`
- [ ] Create `lib/ai/rag/parsers/text.ts` — raw string passthrough
- [ ] Create `lib/ai/rag/parsers/url.ts` — `cheerio` fetch + extract body text
- [ ] Create `lib/ai/rag/parsers/youtube.ts` — fetch transcript via YouTube API or yt-dlp

### Step 6 — AI provider switcher
- [ ] Create `lib/ai/provider.ts`
  - Export `getEmbeddingModel()` — returns OpenAI or Ollama embedding client
  - Export `getLLM()` — returns OpenAI or Ollama chat client
  - Controlled by `AI_PROVIDER` env var

### Step 7 — Ingestion worker
- [ ] Create `lib/ai/rag/ingest.ts`
  - `ingestDocument(documentId: string): Promise<void>`
    1. Fetch Document record from DB
    2. Load file from storage
    3. Parse by `document.type` → raw text
    4. Clean text (strip excess whitespace, boilerplate)
    5. Chunk with `chunker.ts`
    6. For each chunk: embed via `getEmbeddingModel()`
    7. `prisma.documentChunk.createMany([{ content, metadata, embedding }])`
    8. `prisma.document.update({ status: "ready" })`
    9. Trigger curriculum generation job
- [ ] Register pg-boss worker for job name `ingest-document`

### Step 8 — RAG retrieval
- [ ] Create `lib/ai/rag/retrieve.ts`
  - `retrieveChunks(query: string, userId: string, opts?: { courseId?, topK? }): Promise<Chunk[]>`
    1. Embed query
    2. pgvector cosine similarity search on DocumentChunk (scoped to user's documents)
    3. Return top-K chunks with content + metadata

### Step 9 — Upload UI
- [ ] `app/(app)/upload/page.tsx` — layout with dropzone + document list
- [ ] `components/upload/DropZone.tsx`
  - Drag & drop + click to select
  - Shows file name + size preview before upload
  - POST to `/api/upload` on confirm
- [ ] `components/upload/DocumentCard.tsx`
  - Shows name, type, size, status badge
- [ ] `components/upload/ProcessingStatus.tsx`
  - Polls `/api/upload/status/:docId` every 3s until `ready` or `error`

---

## Acceptance Criteria
- [ ] PDF upload → parsed → chunked → embedded → `DocumentChunk` rows created
- [ ] Document status transitions: `processing` → `ready` / `error` visible in UI
- [ ] Free tier: 4th upload attempt returns 403 with clear message
- [ ] Files over 50 MB rejected with 400
- [ ] RAG retrieval returns relevant chunks for a test query

---

## Dependencies to Install
```bash
npm install pdf-parse mammoth cheerio tiktoken @vercel/blob
npm install pg-boss
npm install -D @types/pdf-parse
```
