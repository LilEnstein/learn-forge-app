# LearnForge — App Specification

> Open-source, self-hostable learning platform with RAG + Duolingo-style gamification.
> Clone → run locally → deploy to Vercel in one command.

---

## 1. Tech Stack

### Frontend
| Layer | Choice | Lý do |
|---|---|---|
| Framework | **Next.js 14** (App Router) | SSR + API routes + Vercel native |
| Language | **TypeScript** | Type safety, DX tốt |
| Styling | **Tailwind CSS** + **shadcn/ui** | Rapid UI, accessible components |
| Animation | **Framer Motion** | Map path animation, node unlock |
| State | **Zustand** | Lightweight global state (streak, hearts) |
| Forms | **React Hook Form** + **Zod** | Validation, type-safe schemas |
| Icons | **Lucide React** | Consistent icon set |

### Backend
| Layer | Choice | Lý do |
|---|---|---|
| API | **Next.js API Routes** + **Server Actions** | Collocated với frontend |
| ORM | **Prisma** | Schema-first, migration tốt |
| Database | **PostgreSQL** + extension **pgvector** | Vector storage tích hợp, không cần DB riêng |
| Auth | **Auth.js v5** (NextAuth) | Email/password + OAuth, session-based |
| File storage | **Local filesystem** (dev) / **Vercel Blob** (prod) | Zero-config swap |
| Queue | **pg-boss** | Background job queue trên Postgres, không cần Redis |
| AI SDK | **Vercel AI SDK** | Streaming, provider-agnostic |

### AI / RAG
| Layer | Choice | Lý do |
|---|---|---|
| LLM | **OpenAI GPT-4o** (default) hoặc **Ollama** (local) | Cắm thay thế dễ qua env var |
| Embeddings | **text-embedding-3-small** (OpenAI) hoặc **nomic-embed-text** (Ollama) | Nhỏ gọn, rẻ |
| Vector store | **pgvector** (built into Postgres) | Không cần Pinecone riêng |
| PDF parsing | **pdf-parse** + **mammoth** (docx) | Zero dependency ngoài |
| Chunking | Custom sliding window | Chunk 512 tokens, overlap 64 |

### Infrastructure
| Layer | Choice |
|---|---|
| Local dev DB | **Docker Compose** (postgres + pgvector) |
| Production DB | **Neon** (serverless Postgres, free tier) |
| Deployment | **Vercel** (zero-config Next.js) |
| Env management | `.env.local` (dev) → Vercel env vars (prod) |

---

## 2. Cấu trúc thư mục

```
learnforge/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── layout.tsx
│   ├── (app)/
│   │   ├── layout.tsx            # App shell (sidebar + topbar)
│   │   ├── dashboard/page.tsx    # Chọn chủ đề / tổng quan
│   │   ├── learn/
│   │   │   ├── [courseId]/
│   │   │   │   ├── page.tsx      # Learning map
│   │   │   │   └── lesson/[lessonId]/page.tsx  # Exercise screen
│   │   ├── upload/page.tsx       # Upload tài liệu
│   │   ├── companion/page.tsx    # AI chat companion
│   │   ├── leaderboard/page.tsx
│   │   ├── shop/page.tsx
│   │   └── profile/page.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── upload/route.ts       # File upload endpoint
│   │   ├── courses/
│   │   │   ├── route.ts          # GET list, POST create
│   │   │   └── [id]/route.ts
│   │   ├── lessons/
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       └── submit/route.ts   # Submit answer
│   │   ├── companion/route.ts    # AI streaming chat
│   │   ├── gamification/
│   │   │   ├── streak/route.ts
│   │   │   └── shop/route.ts
│   │   └── generate/
│   │       ├── curriculum/route.ts   # AI sinh lộ trình
│   │       └── exercises/route.ts    # AI sinh bài tập
├── components/
│   ├── map/
│   │   ├── LearningMap.tsx       # Main map component
│   │   ├── MapNode.tsx           # Mỗi nút trên map
│   │   ├── MapConnector.tsx      # Đường nối giữa nút
│   │   └── ChapterHeader.tsx
│   ├── exercise/
│   │   ├── ExerciseScreen.tsx    # Màn hình bài tập
│   │   ├── types/
│   │   │   ├── MultipleChoice.tsx
│   │   │   ├── FillBlank.tsx
│   │   │   ├── Matching.tsx
│   │   │   ├── Ordering.tsx
│   │   │   ├── CodeFillBlank.tsx
│   │   │   └── TrueFalse.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── HeartDisplay.tsx
│   │   └── ResultScreen.tsx
│   ├── gamification/
│   │   ├── StreakBadge.tsx
│   │   ├── GemCounter.tsx
│   │   ├── XPBar.tsx
│   │   ├── LeagueBadge.tsx
│   │   ├── DailyQuest.tsx
│   │   └── StreakFreezeModal.tsx
│   ├── upload/
│   │   ├── DropZone.tsx
│   │   ├── DocumentCard.tsx
│   │   └── ProcessingStatus.tsx
│   ├── companion/
│   │   ├── CompanionChat.tsx
│   │   └── CompanionAvatar.tsx
│   └── ui/                       # shadcn/ui components
├── lib/
│   ├── db/
│   │   ├── prisma.ts             # Prisma client singleton
│   │   └── migrations/
│   ├── ai/
│   │   ├── provider.ts           # OpenAI / Ollama switcher
│   │   ├── rag/
│   │   │   ├── ingest.ts         # Upload → chunk → embed → store
│   │   │   ├── retrieve.ts       # Query → vector search → context
│   │   │   └── chunker.ts        # Sliding window chunking
│   │   ├── generators/
│   │   │   ├── curriculum.ts     # Sinh lộ trình từ tài liệu
│   │   │   └── exercises.ts      # Sinh bài tập từ chunk
│   │   └── prompts/
│   │       ├── curriculum.prompt.ts
│   │       └── exercise.prompt.ts
│   ├── gamification/
│   │   ├── streak.ts             # Streak logic
│   │   ├── hearts.ts             # Heart deduction/refill
│   │   ├── xp.ts                 # XP calculation
│   │   ├── gems.ts               # Gem economy
│   │   └── league.ts             # Weekly league ranking
│   ├── storage/
│   │   ├── local.ts              # Local file save
│   │   └── vercel-blob.ts        # Vercel Blob upload
│   └── utils/
│       ├── cn.ts                 # Tailwind class merge
│       └── dates.ts              # Timezone-aware date utils
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                   # Sample data cho dev
├── hooks/
│   ├── useStreak.ts
│   ├── useHearts.ts
│   ├── useGamification.ts
│   └── useExercise.ts
├── types/
│   ├── course.ts
│   ├── exercise.ts
│   └── gamification.ts
├── docker-compose.yml            # Postgres + pgvector local
├── .env.example                  # Template env vars
└── README.md
```

---

## 3. Database Schema (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector")]
}

// ─── AUTH ───────────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  passwordHash  String?
  emailVerified DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]
  courses       Course[]
  progress      LessonProgress[]
  streakRecord  StreakRecord?
  gamification  UserGamification?
  questProgress DailyQuestProgress[]
  leagueEntry   LeagueEntry[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ─── KNOWLEDGE BASE / RAG ───────────────────────────────

model Document {
  id          String   @id @default(cuid())
  userId      String
  courseId    String?
  name        String
  type        String   // "pdf" | "docx" | "url" | "youtube" | "text"
  storagePath String   // local path hoặc Vercel Blob URL
  sizeBytes   Int
  status      String   @default("processing") // "processing" | "ready" | "error"
  createdAt   DateTime @default(now())

  chunks      DocumentChunk[]
  course      Course?  @relation(fields: [courseId], references: [id])
}

model DocumentChunk {
  id         String                  @id @default(cuid())
  documentId String
  content    String
  metadata   Json                    // { page, position, heading }
  embedding  Unsupported("vector(1536)")?
  document   Document                @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
}

// ─── COURSE / CURRICULUM ─────────────────────────────────

model Course {
  id          String   @id @default(cuid())
  userId      String
  title       String
  topic       String   // "python" | "english" | "sql" | custom
  description String?
  emoji       String   @default("📚")
  status      String   @default("generating") // "generating" | "ready"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User       @relation(fields: [userId], references: [id])
  documents   Document[]
  chapters    Chapter[]
}

model Chapter {
  id          String   @id @default(cuid())
  courseId    String
  title       String
  order       Int
  course      Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  lessons     Lesson[]
}

model Lesson {
  id          String   @id @default(cuid())
  chapterId   String
  title       String
  order       Int
  type        String   @default("standard") // "standard" | "checkpoint"
  xpReward    Int      @default(10)
  gemReward   Int      @default(0)
  chapter     Chapter  @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  exercises   Exercise[]
  progress    LessonProgress[]
}

model Exercise {
  id           String @id @default(cuid())
  lessonId     String
  order        Int
  type         String // "multiple_choice" | "fill_blank" | "matching" | "ordering" | "code_fill" | "true_false"
  question     String
  options      Json?  // Array of options for MCQ / matching
  correctAnswer Json  // String | String[] | { pairs }
  explanation  String?
  difficulty   Int    @default(1) // 1-3
  sourceChunkId String? // Traceability: từ chunk nào sinh ra
  lesson       Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)
}

// ─── PROGRESS ────────────────────────────────────────────

model LessonProgress {
  id          String   @id @default(cuid())
  userId      String
  lessonId    String
  status      String   @default("locked") // "locked" | "available" | "in_progress" | "completed"
  score       Int?     // 0-100
  attempts    Int      @default(0)
  xpEarned    Int      @default(0)
  completedAt DateTime?
  user        User     @relation(fields: [userId], references: [id])
  lesson      Lesson   @relation(fields: [lessonId], references: [id])
  @@unique([userId, lessonId])
}

// ─── GAMIFICATION ────────────────────────────────────────

model UserGamification {
  id           String @id @default(cuid())
  userId       String @unique
  gems         Int    @default(0)
  totalXp      Int    @default(0)
  weeklyXp     Int    @default(0)
  hearts       Int    @default(5)
  maxHearts    Int    @default(5)
  lastHeartAt  DateTime?
  streakFreezes Int   @default(0)
  user         User   @relation(fields: [userId], references: [id])
}

model StreakRecord {
  id            String   @id @default(cuid())
  userId        String   @unique
  currentStreak Int      @default(0)
  longestStreak Int      @default(0)
  lastActivityAt DateTime?
  frozenAt      DateTime?
  user          User     @relation(fields: [userId], references: [id])
}

model DailyQuest {
  id          String @id @default(cuid())
  type        String // "complete_lesson" | "earn_xp" | "perfect_score" | "no_mistakes"
  title       String
  description String
  target      Int    // e.g., 50 for "Earn 50 XP"
  gemReward   Int
  xpReward    Int
}

model DailyQuestProgress {
  id        String   @id @default(cuid())
  userId    String
  questId   String
  date      DateTime @default(now()) // truncated to day
  progress  Int      @default(0)
  completed Boolean  @default(false)
  user      User     @relation(fields: [userId], references: [id])
  @@unique([userId, questId, date])
}

model LeagueEntry {
  id       String @id @default(cuid())
  userId   String
  league   String // "bronze" | "silver" | "gold" | "platinum" | "diamond"
  weekId   String // e.g., "2024-W23"
  weeklyXp Int    @default(0)
  rank     Int?
  promoted Boolean @default(false)
  relegated Boolean @default(false)
  user     User   @relation(fields: [userId], references: [id])
  @@unique([userId, weekId])
}

model Transaction {
  id        String   @id @default(cuid())
  userId    String
  type      String   // "earn_gems" | "spend_gems" | "earn_xp" | "earn_streak_freeze"
  amount    Int
  reason    String   // "lesson_complete" | "purchase_freeze" | "daily_quest" ...
  createdAt DateTime @default(now())
}
```

---

## 4. Environment Variables

```bash
# .env.example

# ── Database ──────────────────────────────────────
# Local (Docker): postgresql://postgres:postgres@localhost:5432/learnforge
# Production (Neon): postgresql://...neon.tech/learnforge?sslmode=require
DATABASE_URL=""

# ── Auth ──────────────────────────────────────────
NEXTAUTH_SECRET=""           # openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"

# OAuth (optional, bỏ qua nếu chỉ dùng email/password)
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# ── AI Provider ───────────────────────────────────
AI_PROVIDER="gemini"         # "gemini" | "openai" | "ollama" | "groq" | "cerebras" | "openai-compat"

# Embedding provider — defaults to AI_PROVIDER when capable.
# Required when AI_PROVIDER=groq or cerebras (they have no embedding support).
# EMBEDDING_PROVIDER="gemini"

# Google AI Studio (Gemini) — recommended default
# Two-key split to separate quota between workloads:
#   GEMINI_API_KEY       → companion chat, RAG retrieval embeddings (high-frequency, low-token)
#   GEMINI_API_KEY_INGEST → PDF parse, curriculum/exercise generation, ingestion embeddings (bursty, high-token)
# If GEMINI_API_KEY_INGEST is absent, all workloads fall back to GEMINI_API_KEY.
GEMINI_API_KEY=""
GEMINI_API_KEY_INGEST=""           # optional; leave blank to share quota with primary key
GEMINI_MODEL="gemini-2.5-flash"
GEMINI_MODEL_LITE="gemini-2.0-flash-lite"   # companion chat and lightweight generation
GEMINI_MODEL_FALLBACKS="gemini-flash-latest,gemini-2.0-flash"
GEMINI_EMBEDDING_MODEL="gemini-embedding-001"

# OpenAI
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o"
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"

# Groq (free cloud LLM — pair with EMBEDDING_PROVIDER=gemini or ollama)
GROQ_API_KEY=""
GROQ_MODEL="llama-3.3-70b-versatile"

# Cerebras (free cloud LLM — pair with EMBEDDING_PROVIDER=gemini or ollama)
CEREBRAS_API_KEY=""
CEREBRAS_MODEL="llama3.1-8b"

# Ollama (local, không cần API key)
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.1"
OLLAMA_EMBEDDING_MODEL="nomic-embed-text"

# ── File Storage ──────────────────────────────────
STORAGE_PROVIDER="local"     # "local" | "vercel-blob"

# Vercel Blob (chỉ cần khi deploy)
BLOB_READ_WRITE_TOKEN=""

# Local storage path
UPLOAD_DIR="./uploads"       # relative to project root

# ── App Config ────────────────────────────────────
NEXT_PUBLIC_APP_URL="http://localhost:3000"
MAX_UPLOAD_SIZE_MB="50"
MAX_DOCUMENTS_FREE="3"       # Giới hạn free tier
```

---

## 5. Core Features — Spec chi tiết

### 5.1 Authentication

**Đăng ký / Đăng nhập:**
- Email + password (bcrypt hash, Zod validation)
- OAuth: GitHub, Google (one-click)
- Session-based auth via Auth.js v5
- Middleware bảo vệ tất cả route `/app/*`
- Profile cơ bản: avatar (Gravatar fallback), display name

**Luồng:**
```
/login → credentials / OAuth → session → redirect /dashboard
/register → email + password → auto-login → onboarding flow
```

**Onboarding (lần đầu):**
- Chọn chủ đề muốn học đầu tiên (màn hình welcome)
- Đặt mục tiêu học mỗi ngày (5 / 10 / 15 phút)
- Chọn avatar/mascot

---

### 5.2 Document Upload & RAG Pipeline

**Upload:**
- Drag & drop hoặc click để upload
- Hỗ trợ: PDF, DOCX, TXT, Markdown
- URL crawl: paste link trang web → crawl nội dung
- YouTube: paste link → fetch transcript (YouTube API hoặc yt-dlp)
- Giới hạn: 50MB/file, free tier 3 tài liệu

**RAG Ingestion Pipeline (chạy background qua pg-boss):**
```
1. Upload file → lưu storage → tạo Document record (status: processing)
2. Parse: pdf-parse / mammoth / cheerio tùy type
3. Clean text: strip boilerplate, normalize whitespace
4. Chunk: sliding window 512 tokens, overlap 64 tokens
5. Embed: gọi embedding model cho từng chunk
6. Store: lưu chunks + embeddings vào DocumentChunk
7. Update Document status → "ready"
8. Trigger curriculum generation
```

**RAG Retrieval:**
```
query → embed query → cosine similarity search pgvector
→ top-K chunks → inject vào LLM prompt → response
```

---

### 5.3 Curriculum Generation

**Trigger:** Sau khi tất cả documents của một course về status "ready"

**Pipeline:**
```
1. Retrieve representative chunks (top 30 theo diversity)
2. Prompt LLM: "Phân tích tài liệu này, tạo curriculum gồm N chương,
   mỗi chương X bài học, mỗi bài 5-7 exercises, output JSON"
3. Validate JSON schema (Zod)
4. Lưu Chapter + Lesson records vào DB
5. Queue job sinh exercises cho từng lesson
```

**Exercise Generation (per lesson):**
```
1. Retrieve chunks liên quan đến lesson topic (RAG)
2. Prompt LLM sinh 5-7 exercises theo type phù hợp:
   - Khái niệm → multiple_choice / true_false
   - Quy trình → ordering
   - Code → code_fill_blank
   - Từ vựng ngôn ngữ → fill_blank / matching
3. Validate + lưu Exercise records
4. Link sourceChunkId để traceability
```

**Curriculum JSON Schema (output của LLM):**
```typescript
{
  title: string,
  description: string,
  chapters: [{
    title: string,
    order: number,
    lessons: [{
      title: string,
      order: number,
      type: "standard" | "checkpoint",
      topic_keywords: string[],  // dùng để RAG retrieve đúng chunks
      xpReward: number,
    }]
  }]
}
```

---

### 5.4 Exercise Engine

**Exercise Screen flow:**
```
Enter lesson → show exercises one by one (progress bar top)
→ user answers → immediate feedback (correct/wrong + explanation)
→ if wrong: lose 1 heart
→ all exercises done → Result screen (XP earned, streak, summary)
```

**6 loại bài tập:**

| Type | Mô tả | Render |
|---|---|---|
| `multiple_choice` | 1 câu hỏi, 4 lựa chọn | Button grid 2x2 |
| `fill_blank` | Điền vào chỗ trống trong câu | Input inline |
| `matching` | Nối cặp (term ↔ definition) | Drag & drop hai cột |
| `ordering` | Sắp xếp các bước đúng thứ tự | Drag & drop vertical list |
| `code_fill_blank` | Hoàn thành đoạn code | Code editor mini (Monaco lite) |
| `true_false` | Đúng / Sai + giải thích | 2 button |

**Submit flow:**
```
POST /api/lessons/{id}/submit
Body: { exerciseId, answer, timeSpentMs }

Server:
1. Validate answer (so với correctAnswer)
2. Tính điểm
3. Nếu hoàn thành lesson: cập nhật LessonProgress
4. Tính XP, gems, cập nhật gamification
5. Check streak
6. Return: { correct, explanation, xpEarned, lessonComplete }
```

---

### 5.5 Gamification Engine

**Streak:**
- Cộng streak khi hoàn thành ít nhất 1 bài trong ngày (UTC+7 timezone)
- Reset về 0 nếu bỏ qua ngày (trừ khi dùng freeze)
- Streak Freeze: consume 1 freeze → giữ streak qua ngày đó
- Milestone thưởng: streak 7 → +30 gems, streak 30 → +100 gems, streak 100 → badge đặc biệt
- Cron job chạy 00:05 mỗi ngày: check và reset streak cho user không hoạt động

**Hearts:**
- Default: 5 hearts, mất 1 mỗi lần sai
- Hồi phục: 1 heart / 30 phút (tự động)
- Unlimited hearts: người dùng Pro
- Refill bằng gems: 150 gems → full hearts
- Hết hearts: modal khóa → "Chờ hồi phục" hoặc "Dùng gems"

**XP & Gems:**
```
Hoàn thành bài học thường: +10 XP, +0 gems
Hoàn thành không sai: +15 XP, +5 gems (Perfect score)
Hoàn thành checkpoint: +25 XP, +15 gems
Daily quest hoàn thành: +10-30 gems tùy quest
Streak milestone: +30-100 gems
```

**Gem Economy:**
```
Earn:   Daily quests, streak milestones, perfect scores, invite friends
Spend:  Streak Freeze (100 gems), Heart Refill (150 gems), 
        Cosmetic themes (500 gems), Weekend Shield (200 gems)
```

**Daily Quests (3 quest mỗi ngày, reset 00:00):**
```
1. Hoàn thành 1 bài học → +20 gems
2. Đạt 50 XP hôm nay → +25 gems
3. Không mắc lỗi trong 1 bài → +30 gems
```

**League System:**
- Xếp hạng theo weekly XP, reset mỗi thứ 2
- 5 hạng: Đồng → Bạc → Vàng → Bạch Kim → Kim Cương
- Top 3 → thăng hạng, bottom 5 (nếu đủ người) → xuống hạng
- Leaderboard chia theo cùng chủ đề học (tránh so sánh không công bằng)

---

### 5.6 Learning Map UI

**Map Layout:**
- Path uốn lượn trái-phải (zigzag) như Duolingo
- Animated path connection bằng Framer Motion
- Mỗi chapter có header (màu sắc riêng)
- Node states: `locked` (mờ) → `available` (sáng, pulsing) → `completed` (đầy màu + checkmark)
- Click node available → modal preview (title, XP reward, estimated time) → "Bắt đầu"
- Click node completed → modal kết quả cũ + "Ôn lại"

**Node types:**
- Standard lesson: hình tròn, icon emoji theo topic
- Checkpoint: hình ngôi sao/shield, màu vàng
- Boss challenge (mỗi cuối khóa): hình lục giác, màu đặc biệt

---

### 5.7 AI Companion

**Tính năng:**
- Chat interface floating button hoặc sidebar
- Context: companion "biết" toàn bộ tài liệu người dùng đã upload (dùng RAG)
- Streaming response (Vercel AI SDK)
- Companion nhớ context của lesson đang học (inject vào system prompt)

**Prompt system:**
```
System: "Bạn là AI học tập cho {username}. Họ đang học {courseTitle}.
Tài liệu nguồn: [retrieved chunks liên quan].
Bài học hiện tại: {lessonTitle}.
Hãy giải thích bằng tiếng Việt, ngắn gọn, dễ hiểu, dùng ví dụ thực tế."
```

**Proactive notifications** (server-sent events hoặc polling):
- "Bạn sắp mất streak! Còn 2 tiếng nữa."
- "Bạn hay sai ở phần X, muốn ôn lại không?"
- "Chúc mừng! 7 ngày liên tiếp 🔥"

---

### 5.8 Profile & Statistics

**Trang Profile:**
- Avatar + display name + level badge + league badge
- Heatmap hoạt động theo tháng (giống GitHub contribution graph)
- Biểu đồ XP theo tuần (recharts)
- Badge collection (earned / locked)
- Streak history

**Stats per course:**
- Tổng số bài đã hoàn thành / tổng bài
- Accuracy rate (% câu đúng)
- Thời gian học trung bình mỗi ngày

---

## 6. API Routes

```
POST   /api/auth/register
POST   /api/auth/[...nextauth]

GET    /api/courses                  # Danh sách course của user
POST   /api/courses                  # Tạo course mới
GET    /api/courses/:id              # Course detail + chapters + lessons (với progress)
DELETE /api/courses/:id

POST   /api/upload                   # Upload document → queue ingestion
GET    /api/upload/status/:docId     # Polling ingestion status
POST   /api/generate/curriculum      # Trigger curriculum gen (gọi sau upload xong)

GET    /api/lessons/:id              # Lesson + exercises
POST   /api/lessons/:id/submit       # Submit answer, cập nhật progress

GET    /api/gamification/me          # Streak, hearts, gems, XP, quests
POST   /api/gamification/shop        # Mua item bằng gems
POST   /api/gamification/streak/freeze  # Dùng streak freeze

GET    /api/leaderboard?courseId=    # Bảng xếp hạng theo topic
GET    /api/profile/:userId          # Public profile

POST   /api/companion                # AI companion chat (streaming)
```

---

## 7. Setup & Run Locally

```bash
# 1. Clone repo
git clone https://github.com/your-username/learnforge
cd learnforge

# 2. Install dependencies
npm install

# 3. Start Postgres + pgvector (Docker)
docker-compose up -d

# 4. Setup environment
cp .env.example .env.local
# Điền DATABASE_URL, NEXTAUTH_SECRET, OPENAI_API_KEY (hoặc để trống nếu dùng Ollama)

# 5. Run DB migrations
npx prisma migrate dev
npx prisma db seed     # Sample data

# 6. (Optional) Dùng Ollama thay OpenAI
ollama pull llama3.1
ollama pull nomic-embed-text
# Set AI_PROVIDER=ollama trong .env.local

# 7. Run dev server
npm run dev
# → http://localhost:3000
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: learnforge
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
volumes:
  postgres_data:
```

---

## 8. Deploy to Vercel

```bash
# 1. Tạo Neon DB tại neon.tech (free)
#    Copy DATABASE_URL dạng: postgresql://...neon.tech/learnforge?sslmode=require

# 2. Deploy
vercel

# 3. Thêm env vars trong Vercel dashboard:
#    DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL (https://your-app.vercel.app)
#    OPENAI_API_KEY, BLOB_READ_WRITE_TOKEN (Vercel Blob → tạo trong dashboard)
#    STORAGE_PROVIDER=vercel-blob, AI_PROVIDER=openai

# 4. Run migration trên Neon
DATABASE_URL="..." npx prisma migrate deploy
```

---

## 9. Roadmap

### v0.1 — MVP (chạy được, core loop)
- [ ] Auth (email/password)
- [ ] Upload PDF + RAG ingestion
- [ ] Curriculum generation (cơ bản)
- [ ] 3 loại bài tập: multiple_choice, fill_blank, true_false
- [ ] Learning map (static layout)
- [ ] Streak cơ bản

### v0.2 — Gamification
- [ ] Hearts system
- [ ] Gems economy
- [ ] Daily quests
- [ ] XP + level
- [ ] Shop (streak freeze, heart refill)

### v0.3 — Full UI
- [ ] Animated learning map
- [ ] Leaderboard + leagues
- [ ] Profile + stats + heatmap
- [ ] Onboarding flow
- [ ] Matching + Ordering exercise types

### v0.4 — AI Companion + Advanced RAG
- [ ] AI companion chat (streaming)
- [ ] YouTube transcript support
- [ ] URL crawling
- [ ] Code fill-blank exercise (Monaco editor)
- [ ] Proactive notifications

### v0.5 — Polish + Open Source
- [ ] OAuth (GitHub + Google)
- [ ] Dark mode
- [ ] Mobile responsive
- [ ] README + contribution guide
- [ ] Docker all-in-one compose (app + db)
- [ ] Demo instance public
