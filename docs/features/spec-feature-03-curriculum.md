# Feature 03 — Curriculum Generation

## Overview
After all documents for a course reach "ready" status, an AI pipeline generates a structured curriculum (chapters → lessons → exercises) by prompting the LLM with representative document chunks.

---

## User Stories
- As a user, my course curriculum is automatically generated after I upload and process documents
- As a user, I can see my course's chapters and lessons on the learning map
- As a user, each lesson has 5–7 AI-generated exercises relevant to the lesson topic
- As a user, I can track which exercise chunk each question came from (traceability)

---

## Trigger Condition
Fires after **all** documents in a course reach `status = "ready"`.

---

## Curriculum Generation Pipeline
```
1. Retrieve representative chunks (top 30 by diversity) from course documents
2. Prompt LLM: "Analyze this material, create a curriculum with N chapters,
   X lessons each, each lesson 5-7 exercises, output JSON"
3. Validate JSON schema (Zod)
4. Save Chapter + Lesson records to DB
5. Queue per-lesson exercise generation jobs (pg-boss)
```

---

## Exercise Generation Pipeline (per lesson)
```
1. Retrieve chunks relevant to lesson topic (RAG search by topic_keywords)
2. Prompt LLM to generate 5-7 exercises matching content type:
   - Concepts → multiple_choice / true_false
   - Processes → ordering
   - Code → code_fill_blank
   - Vocabulary/language → fill_blank / matching
3. Validate + save Exercise records
4. Link sourceChunkId for traceability
```

---

## Curriculum JSON Schema (LLM output)
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
      topic_keywords: string[],  // used for RAG chunk retrieval
      xpReward: number,
    }]
  }]
}
```

---

## Exercise Types
| Content Type | Exercise Type |
|---|---|
| Concepts | `multiple_choice`, `true_false` |
| Processes / Steps | `ordering` |
| Code completion | `code_fill_blank` |
| Vocabulary / Language | `fill_blank`, `matching` |

---

## Database Models

```prisma
model Course {
  id          String   @id @default(cuid())
  userId      String
  title       String
  topic       String
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
  id            String @id @default(cuid())
  lessonId      String
  order         Int
  type          String // "multiple_choice" | "fill_blank" | "matching" | "ordering" | "code_fill" | "true_false"
  question      String
  options       Json?  // Array of options for MCQ / matching
  correctAnswer Json   // String | String[] | { pairs }
  explanation   String?
  difficulty    Int    @default(1) // 1-3
  sourceChunkId String? // Traceability: which chunk this was generated from
  lesson        Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)
}
```

---

## API Routes
```
GET    /api/courses             # List user's courses
POST   /api/courses             # Create new course
GET    /api/courses/:id         # Course detail + chapters + lessons (with progress)
DELETE /api/courses/:id
POST   /api/generate/curriculum # Trigger curriculum generation
POST   /api/generate/exercises  # Trigger exercise generation for a lesson (internal)
```

---

## Key Files
```
lib/ai/
  provider.ts                     # OpenAI / Ollama switcher
  generators/
    curriculum.ts                 # Generate course structure from chunks
    exercises.ts                  # Generate exercises per lesson
  prompts/
    curriculum.prompt.ts          # System + user prompt template
    exercise.prompt.ts
  rag/
    retrieve.ts                   # Used to fetch relevant chunks per lesson topic
```

---

## Validation
- LLM JSON output validated with Zod before DB writes
- If validation fails: log error, mark course status as "error"
- `topic_keywords` array required per lesson (drives per-lesson RAG)

---

## Environment Variables
```bash
AI_PROVIDER="openai"              # "openai" | "ollama"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.1"
```
