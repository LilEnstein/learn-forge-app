# Plan — Feature 03: Curriculum Generation

## Prerequisites
- Feature 02 (Upload & RAG) complete — documents must be ingested before curriculum can be generated
- Prisma models: Course, Chapter, Lesson, Exercise
- `lib/ai/provider.ts` and `lib/ai/rag/retrieve.ts` available
- pg-boss queue running

---

## Implementation Steps

### Step 1 — Prisma schema & migration
- [ ] Add Course, Chapter, Lesson, Exercise models to `prisma/schema.prisma`
- [ ] Run `npx prisma migrate dev --name add-curriculum-models`

### Step 2 — Zod schemas for LLM output validation
- [ ] Create `lib/ai/generators/schemas.ts`
  - `CurriculumSchema` — validates the full curriculum JSON from LLM
  - `ExerciseSchema` — validates a single exercise JSON object
  - `ExercisesArraySchema` — validates a lesson's exercise batch

### Step 3 — Curriculum prompt
- [ ] Create `lib/ai/prompts/curriculum.prompt.ts`
  - Returns system + user prompt string given `{ chunks, courseTitle, topic }`
  - Instructs LLM to output strict JSON matching CurriculumSchema
  - Specifies: N chapters, X lessons each, `topic_keywords` per lesson

### Step 4 — Curriculum generator
- [ ] Create `lib/ai/generators/curriculum.ts`
  - `generateCurriculum(courseId: string): Promise<void>`
    1. Fetch course + its ready documents from DB
    2. `retrieveChunks(courseTitle, userId, { courseId, topK: 30 })` — diverse sample
    3. Build prompt from chunks
    4. Call LLM via `getLLM()`, parse JSON response
    5. Validate with `CurriculumSchema` (Zod) — throw if invalid
    6. Write `Chapter` + `Lesson` records in a transaction
    7. `prisma.course.update({ status: "ready" })`
    8. Enqueue one `generate-exercises { lessonId }` job per lesson

### Step 5 — Exercise prompt
- [ ] Create `lib/ai/prompts/exercise.prompt.ts`
  - Returns prompt given `{ lessonTitle, topicKeywords, chunks }`
  - Maps content type to preferred exercise types in the prompt instructions
  - Instructs strict JSON output per ExercisesArraySchema

### Step 6 — Exercise generator
- [ ] Create `lib/ai/generators/exercises.ts`
  - `generateExercises(lessonId: string): Promise<void>`
    1. Fetch lesson + topicKeywords from DB
    2. `retrieveChunks(topicKeywords.join(' '), userId, { courseId, topK: 10 })`
    3. Build prompt, call LLM, parse + validate JSON
    4. Write `Exercise` records with `sourceChunkId` links

### Step 7 — pg-boss workers
- [ ] Register worker `generate-curriculum { courseId }` → calls `generateCurriculum()`
- [ ] Register worker `generate-exercises { lessonId }` → calls `generateExercises()`
- [ ] Both workers: on failure update course/lesson status to "error", log error

### Step 8 — API routes
- [ ] `app/api/courses/route.ts`
  - GET: return user's courses with status
  - POST `{ title, topic, documentIds }`: create Course record, trigger `generate-curriculum` job
- [ ] `app/api/courses/[id]/route.ts`
  - GET: course + chapters + lessons + LessonProgress for current user
  - DELETE: cascade delete course + documents + chunks
- [ ] `app/api/generate/curriculum/route.ts`
  - POST: manually re-trigger curriculum generation for a courseId (idempotent)

### Step 9 — Dashboard UI
- [ ] `app/(app)/dashboard/page.tsx`
  - List user's courses (title, status, emoji, progress %)
  - "Create new course" button → triggers upload flow + course creation
  - Course card → navigate to `/learn/[courseId]`

---

## Acceptance Criteria
- [ ] After documents reach "ready", `generate-curriculum` job fires automatically
- [ ] Course status progresses: `generating` → `ready`
- [ ] All chapters, lessons, and exercises are persisted with correct relations
- [ ] Invalid LLM JSON retried once, then marks course as "error"
- [ ] Each exercise has a non-null `sourceChunkId` pointing to the originating chunk
- [ ] `topic_keywords` present on every lesson
