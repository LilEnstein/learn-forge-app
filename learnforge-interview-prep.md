# LearnForge — Interview Preparation Guide
# LearnForge — Tài Liệu Ôn Phỏng Vấn

> **Cách dùng:** Đọc phần tiếng Việt để hiểu sâu. Đọc phần tiếng Anh để luyện nói với interviewer.  
> Mỗi section có: EN (nói với interviewer) → VI (giải thích để hiểu thật sự)

---

## 1. What is LearnForge? / Dự án là gì?

**🇬🇧 Tell me about this project (elevator pitch — 30 giây):**

> "LearnForge is an AI-powered learning platform that turns static documents — PDFs, Word files — into personalized, gamified learning experiences. You upload a document, the system automatically generates a structured curriculum, exercises, and an AI companion, all grounded in your actual content using RAG. It supports 6 AI providers with a 3-tier key management system, and includes a full gamification engine: streaks, hearts, XP, gems, and weekly leagues."

**🇻🇳 Hiểu để không nói vẹt:**

Bản chất dự án là pipeline biến tài liệu tĩnh → học liệu động:
- Input: file PDF/DOCX của người dùng
- Processing: RAG pipeline (chunk → embed → store vector)
- Output: curriculum tự động + bài tập + companion AI
- Engagement layer: gamification giữ người dùng quay lại

---

## 2. Tech Stack — Chi Tiết Từ Code Thật

**🇬🇧 What's your tech stack and why?**

> "Next.js 14 with App Router for the full-stack framework, PostgreSQL 16 with pgvector extension for both relational data and vector search in a single database, Auth.js v5 with JWT strategy, Inngest for production background jobs, and direct AI SDKs — openai, @google/generative-ai — rather than an abstraction layer, to preserve full control over streaming and model selection."

**🇻🇳 Stack thực tế từ `package.json` và `docker-compose.yml`:**

| Layer | Công nghệ | Lý do chọn |
|---|---|---|
| Framework | Next.js 14.2.35 — App Router | Server Components giảm JS bundle; API routes cùng repo |
| Language | TypeScript 5 | Type-safe toàn bộ từ DB schema đến API response |
| UI | Tailwind + shadcn/ui + framer-motion | Radix primitives cho accessibility; framer cho animation map |
| Database | PostgreSQL 16 + pgvector | 1 DB cho cả relational và vector — không cần Pinecone riêng |
| ORM | Prisma 5.22 | Type-safe queries; nhưng vector phải dùng `$executeRaw` |
| Auth | Auth.js v5 (next-auth beta) | JWT strategy + PrismaAdapter |
| AI | openai, @google/generative-ai, ollama | SDK trực tiếp — README nói Vercel AI SDK nhưng code không dùng |
| Background jobs | Inngest (prod) + pg-boss (local cron only) | Inngest cho serverless; pg-boss cho cron streak/league |
| Storage | Local FS (dev) / Vercel Blob (prod) | Switch qua `STORAGE_PROVIDER` env var |

> ⚠️ **Honest note để nói với interviewer:** "One thing I discovered while building: README advertised Vercel AI SDK, but the actual implementation uses direct SDKs for finer control. That gap between spec and implementation taught me to always verify claims against the code."

---

## 3. RAG Pipeline — Giải Thích Từng Dòng Code

**🇬🇧 How does your RAG pipeline work?**

> "The pipeline has two phases: ingest and retrieve. During ingest, uploaded documents are parsed — PDFs through Gemini Files API to avoid OOM issues with pdf-parse, DOCX through mammoth. Text is then chunked using a sliding window of 1,200 characters with 150-character overlap, prioritizing paragraph and sentence boundaries. Chunks are embedded in batches of 20 and stored as vectors in PostgreSQL using pgvector. During retrieval, a query is embedded and compared against stored vectors using cosine distance — the `<=>` operator — returning the top-K most relevant chunks as context for the LLM."

**🇻🇳 Deep dive từng bước:**

### INGEST Flow:
```
Upload file
  → Vercel Blob (lưu file)
  → inngest.send("app/document.uploaded")
  → [Inngest function: ingest]
      → fetch file từ Blob URL
      → parseBuffer():
          PDF  → Gemini Files API  ← không dùng pdf-parse (OOM risk)
          DOCX → mammoth
          TXT/MD → utf8 decode
      → chunkText(1200, 150):
          Sliding window theo KÝ TỰ (không phải token)
          Breakpoint priority: \n\n > ". " > word > hard cut
          overlap = charStart của chunk mới = charEnd_prev - 150
      → embed mỗi chunk (batch 20, Promise.all):
          getEmbeddingModel().embedContent(chunk.text)
          → vector float[] độ dài 1536
      → lưu vào DB:
          Prisma tạo DocumentChunk row trước
          $executeRaw: UPDATE ... SET embedding = '[0.1,0.2,...]'::vector
          ← Prisma không hỗ trợ vector type nên phải raw SQL
      → SSE progress event: 35% → 95% → 100%
  → tất cả chunks ready → inngest.send("curriculum-requested")
```

### RETRIEVE Flow:
```typescript
// lib/ai/rag/retrieve.ts
const queryEmbedding = await embedModel.embedContent(query);
const results = await prisma.$queryRaw`
  SELECT id, text, metadata,
         1 - (embedding <=> ${queryVector}::vector) as similarity
  FROM "DocumentChunk"
  WHERE "userId" = ${userId}
    AND "status" = 'ready'
  ORDER BY embedding <=> ${queryVector}::vector
  LIMIT ${topK}
`;
```

- `<=>` = cosine distance (pgvector operator)
- `1 - distance` = cosine similarity (0→1, càng cao càng giống)
- topK = **30** cho curriculum generation, **10** cho exercise generation
- Không có similarity threshold — luôn trả đủ topK dù chunk không liên quan

> ⚠️ **Điểm yếu để biết:** Không có threshold filter nghĩa là nếu tài liệu ngắn, LLM vẫn nhận đủ 30 chunk dù nhiều chunk không liên quan.

---

## 4. LLM Key Management — 3-Tier System

**🇬🇧 How do you handle AI API keys for multiple users?**

> "There's a 3-tier fallback system. First, we check if the user has their own API key stored — encrypted with AES-256-GCM in the database, so plaintext never touches storage. If not, we fall back to environment variables. If those aren't configured either, we use an admin-managed pool of keys with round-robin rotation and daily usage limits. Failover is automatic: a 429 response triggers rotation to the next available key, while a 401 marks the key as invalid."

**🇻🇳 Chi tiết từ code:**

### Thứ tự fallback (`lib/ai/user-provider.ts`):
```
getProviderForUser(userId, task)
  1. UserApiKey của user (status=active, isDefault=true)
       → decryptKey(encryptedKey, iv, authTag)
       → createProvider(config)
  2. Không có user key → kiểm tra env var (hasEnvKey)
       → OPENAI_API_KEY / GEMINI_API_KEY / GROQ_API_KEY...
  3. Không có env → PoolKey của admin
       → lấy key có priority cao nhất, dailyUsed < dailyLimit
       → round-robin theo priority
  4. Không có gì → throw NoAiKeyError
```

### Mã hóa key (`lib/ai/crypto.ts`):
```typescript
// Encrypt khi user lưu key
const iv = crypto.randomBytes(12);           // 96-bit IV
const cipher = crypto.createCipheriv('aes-256-gcm', secret, iv);
const encrypted = cipher.update(plaintext);
const authTag = cipher.getAuthTag();         // 128-bit auth tag

// Lưu DB: encryptedKey (base64) + iv (base64) + authTag (base64)
// Plaintext key KHÔNG BAO GIỜ chạm DB
```

### Failover (`lib/ai/with-failover.ts`):
```
withFailover(userId, task, fn):
  → chạy fn() với key hiện tại
  → nếu lỗi:
      401/403 hoặc "invalid api key"
        → markInvalid(keyId)
        → throw InvalidUserKeyError
      429 / "quota" / "rate_limit" / "resource_exhausted"
        → markQuotaExceeded(keyId, quotaResetHint = now + 24h)
        → retry 1 lần với getNextActiveKey()
        → nếu không còn key → throw QuotaExhaustedError
```

### Per-task model selection:
```
4 task types → model riêng:
  fileProcessing  → GEMINI_MODEL (vì parse PDF dùng Gemini Files API)
  courseGen       → model cho curriculum/exercise generation
  companion       → model cho chat
  embedding       → EMBEDDING_MODEL (text-embedding-3-small hoặc tương đương)
```

> ⚠️ **Coupling ẩn quan trọng:** PDF parsing dùng Gemini Files API bắt buộc phải có `GEMINI_API_KEY` dù `AI_PROVIDER=openai`. Đây là hard dependency bị giấu.

---

## 5. AI Content Generation

**🇬🇧 How does the AI generate curriculum and exercises?**

> "After ingestion, the system retrieves the 30 most relevant chunks based on the course title, then sends them as context to the LLM with a structured prompt requesting JSON output: 3 to 5 chapters, each with 3 to 5 lessons, with every third lesson being a checkpoint. The output is validated with Zod. Exercise generation follows the same pattern but retrieves only 10 chunks per topic, generating 3 to 5 exercises per lesson."

**🇻🇳 Chi tiết:**

### Curriculum generation:
```
retrieve(courseTitle, topK=30)
  → prompt template (curriculum.prompt.ts):
      "Given these document excerpts, create a curriculum in JSON format:
       { chapters: [{ title, lessons: [{ title, keywords[], isCheckpoint }] }] }"
       every 3rd lesson → isCheckpoint: true
  → LLM response → extractJson() bóc code fence
  → JSON.parse() → nếu fail → retry với "respond only valid JSON"
  → Zod CurriculumSchema validate
  → DB transaction: tạo Chapter + Lesson records
  → inngest.send exercise generation cho từng lesson
```

### Zod schema thực tế:
```typescript
const ExerciseSchema = z.object({
  type: z.enum(['multiple_choice', 'fill_blank', 'true_false']),
  // ← CHỈ 3 loại, dù UI hỗ trợ 6 loại
  question: z.string(),
  options: z.array(z.string()).optional(),
  answer: z.string(),
  explanation: z.string(),
});
```

> 🔴 **Bug quan trọng:** ExerciseSchema chỉ cho phép 3 loại. UI components cho `matching`, `ordering`, `code_fill_blank` tồn tại nhưng generator không bao giờ sinh ra chúng → **code chết**.

---

## 6. Gamification Engine

**🇬🇧 Tell me about the gamification system.**

> "There are four interconnected mechanics. Streaks track daily learning activity, with timezone handling done manually for UTC+7. Hearts act as a life system — you lose one per wrong answer, and they refill one every 30 minutes based on timestamps. XP and gems are awarded on lesson completion, with bonus amounts for perfect runs or checkpoints. Finally, there's a weekly league system that promotes the top 3 and relegates the bottom 5 each week."

**🇻🇳 Chi tiết từ code:**

### Streak (`lib/gamification/streak.ts`):
```typescript
// Timezone xử lý thủ công — không dùng library
const UTC7_OFFSET_MS = 7 * 60 * 60 * 1000;
const todayStr = new Date(Date.now() + UTC7_OFFSET_MS)
  .toISOString().slice(0, 10); // "2024-01-15"

// Logic:
// todayStr === lastActivityDate → đã ghi hôm nay, giữ nguyên
// todayStr === yesterday        → streak + 1
// else                          → streak reset = 1

// Milestone gems: streak 7 → 30 gems, streak 30 → 100 gems
// Freeze: frozenAt = hôm nay → bỏ qua reset nếu frozenAt === yesterday
```

### Hearts (`lib/gamification/hearts.ts`):
```typescript
// Timestamp-based, không dùng polling/cron
function computeHearts(lastHeartAt: Date, currentHearts: number) {
  const elapsed = Date.now() - lastHeartAt.getTime();
  const refilled = Math.floor(elapsed / (30 * 60 * 1000)); // mỗi 30 phút
  return Math.min(5, currentHearts + refilled);
}
// Refill bằng gems: 150 gems → full 5 hearts
```

### XP/Gems per action:
```
Checkpoint lesson: 25 XP + 15 gems
Perfect lesson:    15 XP + 5 gems
Normal lesson:     10 XP + 0 gems
```

### League:
```
weekId = YYYY-Www  (ISO week format, ví dụ "2024-W03")
Top 3    → promote lên league cao hơn
Bottom 5 → relegate xuống league thấp hơn (chỉ khi ≥ 10 người)
Reset weeklyXp mỗi tuần qua pg-boss cron
```

---

## 7. Background Job Architecture

**🇬🇧 How do you handle long-running tasks like document processing?**

> "The production path uses Inngest, which integrates well with Vercel's serverless environment. There are three chained functions: document ingest with 3 retries, curriculum generation with 2 retries, and exercise generation with 2 retries and a concurrency limit of 4. I also used pg-boss for scheduled cron jobs — streak reset and league finalization — though I later discovered this only runs locally, not on Vercel, which is a known issue I'd fix by migrating those crons to Inngest."

**🇻🇳 Sơ đồ thực tế:**

```
INNGEST (production path — chạy cả trên Vercel):
─────────────────────────────────────────────────
  inngest.send("app/document.uploaded")
    └─ [ingest function, retry=3]
         → parse → chunk → embed → pgvector
         → checkAndTriggerCurriculum()
              └─ inngest.send("curriculum-requested")
                   └─ [curriculum function, retry=2]
                        → retrieve 30 chunks → LLM → DB
                        → inngest.send("exercises-requested") × N lessons
                             └─ [exercises function, retry=2, concurrency=4]
                                  → retrieve 10 chunks → LLM → DB

PG-BOSS (chỉ chạy local — SKIP trên Vercel):
─────────────────────────────────────────────
  Cron: "streak-daily-check"  (17:05 UTC = 00:05 UTC+7)
    → checkAndResetStreaks()
  Cron: "league-weekly-reset" (CN 17:00 UTC)
    → finalizeLeague() → reset weeklyXp

⚠️ DEAD CODE (workers đăng ký nhưng không ai gửi job):
─────────────────────────────────────────────────────
  pg-boss workers: ingest / curriculum / exercises
  → lib/queue/boss.ts có hàm send() nhưng KHÔNG được gọi ở đâu
  → Toàn bộ pipeline dùng Inngest, không dùng boss.send()
```

> 🔴 **Hậu quả thực tế:** Trên Vercel production, streak và league KHÔNG BAO GIỜ reset vì pg-boss cron không chạy và không có Inngest cron thay thế.

---

## 8. Known Issues — Trả Lời Thẳng Thắn

**🇬🇧 What would you improve if you had more time?**

> "There are four things I'd prioritize. First, the AI companion doesn't actually use RAG — it only injects the course and lesson title into the system prompt. That contradicts the README and needs to be fixed by calling retrieveChunks in the companion route. Second, the streak and league cron jobs only run locally due to pg-boss not starting on Vercel — I'd migrate those to Inngest scheduled functions. Third, the SSE progress tracking uses an in-memory EventEmitter, which breaks on serverless multi-instance deployments. And fourth, I'd complete the exercise generator to support all 6 types instead of just 3."

**🇻🇳 Chi tiết từng issue:**

| # | Vấn đề | File liên quan | Fix |
|---|---|---|---|
| 🔴 1 | Companion không dùng RAG — chỉ inject tiêu đề | `app/api/companion/route.ts` | Gọi `retrieveChunks(query, userId)` trong route, nhồi chunks vào system prompt |
| 🔴 2 | Cron chỉ chạy local → streak/league không reset trên Vercel | `instrumentation.ts` | Migrate streak + league cron sang Inngest `inngest.createScheduledFunction` |
| 🔴 3 | 3/6 loại bài tập không bao giờ được sinh | `lib/ai/generators/exercises.ts` | Mở rộng Zod ExerciseSchema + prompt để sinh đủ 6 loại |
| 🟠 4 | SSE progress dùng EventEmitter in-memory | `lib/events/progress-emitter.ts` | Dùng Redis pub/sub hoặc Inngest realtime thay thế |
| 🟠 5 | Storage factory bị bypass ở hot path | `app/api/upload/route.ts` | Gọi `storage.saveFile()` thay vì `put()` trực tiếp |
| 🟡 6 | embedFn ingest vs retrieve có thể dùng khác model | `lib/ai/rag/retrieve.ts` | Đảm bảo cùng embedding model/provider cho cả ingest và query |

---

## 9. Câu Hỏi Interviewer Hay Hỏi — Và Cách Trả Lời

**Q: "Tại sao dùng PostgreSQL cho vector search thay vì Pinecone hay Qdrant?"**

> "PostgreSQL with pgvector lets us consolidate everything into a single database — user data, course content, and vectors. For the scale this project targets, the performance is more than sufficient. The trade-off is that pgvector's ANN (approximate nearest neighbor) capabilities are less mature than dedicated vector databases, but we can add indexing like HNSW as the dataset grows."

**Q: "Chunking theo ký tự thay vì token — có vấn đề gì không?"**

> "It's a pragmatic trade-off. Token counting requires running tiktoken on every chunk, which adds latency. Character-based chunking is fast and deterministic. The risk is that 1,200 characters isn't a fixed token count — Vietnamese text typically has fewer tokens per character than English. For this project it works fine, but a production system should chunk by tokens to precisely control LLM context usage."

**Q: "Nếu làm lại từ đầu, bạn thay đổi gì?"**

> "Three things. I'd design the cron strategy for serverless from day one — pg-boss is great locally but serverless needs a different approach. I'd complete the companion RAG integration before shipping rather than leaving it as a known gap. And I'd implement a similarity threshold in retrieval so low-relevance chunks don't pollute the LLM context."

---

## 10. Quick Reference — Số Liệu Cần Nhớ

| Metric | Giá trị |
|---|---|
| Chunk size | 1,200 ký tự |
| Chunk overlap | 150 ký tự |
| Embed batch size | 20 chunks/batch |
| Vector dimensions | 1,536 (text-embedding-3-small) |
| topK — curriculum | 30 chunks |
| topK — exercise | 10 chunks |
| Hearts max | 5 |
| Heart refill rate | 1 per 30 minutes |
| Gems to refill hearts | 150 gems |
| Streak milestone 1 | 7 ngày → 30 gems |
| Streak milestone 2 | 30 ngày → 100 gems |
| Exercise types (supported) | 6 |
| Exercise types (generated) | 3 (bug) |
| AI providers supported | 6 (openai, gemini, groq, cerebras, openai-compat, ollama) |
| Key management tiers | 3 (user → env → admin pool) |
| Inngest retry — ingest | 3 lần |
| Inngest retry — curriculum | 2 lần |
| Inngest concurrency — exercises | 4 |
