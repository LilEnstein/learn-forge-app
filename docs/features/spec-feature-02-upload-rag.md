# Feature 02 — Document Upload & RAG Pipeline

## Overview
Users upload learning materials (PDF, DOCX, TXT, Markdown, URLs, YouTube). A background pipeline parses, chunks, embeds, and stores them in pgvector for RAG retrieval.

---

## User Stories
- As a user, I can drag & drop or click to upload a PDF/DOCX/TXT/MD file
- As a user, I can paste a URL to crawl web content as a document
- As a user, I can paste a YouTube link to import its transcript
- As a user, I can see real-time processing status (processing → ready / error)
- As a user on free tier, I am limited to 3 documents

---

## Supported Input Types
| Type | Parser |
|---|---|
| PDF | pdf-parse |
| DOCX | mammoth |
| TXT / Markdown | raw text |
| URL | cheerio (web crawl) |
| YouTube | YouTube API or yt-dlp transcript |

---

## RAG Ingestion Pipeline (background via pg-boss)
```
1. Upload file → save to storage → create Document record (status: processing)
2. Parse: pdf-parse / mammoth / cheerio depending on type
3. Clean text: strip boilerplate, normalize whitespace
4. Chunk: sliding window 512 tokens, overlap 64 tokens
5. Embed: call embedding model for each chunk
6. Store: save chunks + embeddings into DocumentChunk
7. Update Document status → "ready"
8. Trigger curriculum generation
```

---

## RAG Retrieval
```
query → embed query → cosine similarity search pgvector
→ top-K chunks → inject into LLM prompt → response
```

---

## Database Models

```prisma
model Document {
  id          String   @id @default(cuid())
  userId      String
  courseId    String?
  name        String
  type        String   // "pdf" | "docx" | "url" | "youtube" | "text"
  storagePath String   // local path or Vercel Blob URL
  sizeBytes   Int
  status      String   @default("processing") // "processing" | "ready" | "error"
  createdAt   DateTime @default(now())

  chunks      DocumentChunk[]
  course      Course?  @relation(fields: [courseId], references: [id])
}

model DocumentChunk {
  id         String                      @id @default(cuid())
  documentId String
  content    String
  metadata   Json                        // { page, position, heading }
  embedding  Unsupported("vector(1536)")?
  document   Document                    @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
}
```

---

## API Routes
```
POST /api/upload                    # Upload file → queue ingestion job
GET  /api/upload/status/:docId      # Poll ingestion status
```

---

## Key Files
```
app/(app)/upload/page.tsx
components/upload/
  DropZone.tsx
  DocumentCard.tsx
  ProcessingStatus.tsx
lib/ai/rag/
  ingest.ts          # Upload → chunk → embed → store
  retrieve.ts        # Query → vector search → context assembly
  chunker.ts         # Sliding window chunking (512 tokens, overlap 64)
lib/storage/
  local.ts           # Local filesystem save (dev)
  vercel-blob.ts     # Vercel Blob upload (prod)
```

---

## Chunking Strategy
- Algorithm: sliding window
- Chunk size: 512 tokens
- Overlap: 64 tokens
- Metadata stored per chunk: `{ page, position, heading }`

---

## Embedding Models
| Provider | Model |
|---|---|
| OpenAI | text-embedding-3-small (1536 dims) |
| Ollama | nomic-embed-text |

---

## Storage Strategy
| Environment | Provider |
|---|---|
| Development | Local filesystem (`./uploads`) |
| Production | Vercel Blob |

Swap controlled by `STORAGE_PROVIDER` env var.

---

## Limits
- Max file size: 50 MB
- Free tier: 3 documents max (`MAX_DOCUMENTS_FREE`)

---

## Environment Variables
```bash
STORAGE_PROVIDER="local"          # "local" | "vercel-blob"
BLOB_READ_WRITE_TOKEN=""          # Vercel Blob token (prod only)
UPLOAD_DIR="./uploads"            # Local storage path
MAX_UPLOAD_SIZE_MB="50"
MAX_DOCUMENTS_FREE="3"

# Embedding (shared with AI provider config)
AI_PROVIDER="openai"              # "openai" | "ollama"
OPENAI_API_KEY=""
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_EMBEDDING_MODEL="nomic-embed-text"
```
