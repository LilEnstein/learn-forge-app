# Plan — Feature 04: Exercise Engine

## Prerequisites
- Feature 03 (Curriculum) complete — lessons and exercises must exist in DB
- Feature 05 (Gamification) hearts/XP hooks available (can stub initially)
- Prisma model: LessonProgress

---

## Implementation Steps

### Step 1 — Prisma migration
- [ ] Add LessonProgress model to `prisma/schema.prisma`
- [ ] Run `npx prisma migrate dev --name add-lesson-progress`
- [ ] Seed first lesson of each course as `available` on course creation

### Step 2 — Lesson API
- [ ] `app/api/lessons/[id]/route.ts` (GET)
  - Auth check
  - Return lesson + ordered exercises (omit `correctAnswer` from response)
  - Include user's LessonProgress for this lesson
- [ ] `app/api/lessons/[id]/submit/route.ts` (POST)
  - Body: `{ exerciseId, answer, timeSpentMs }`
  - Fetch exercise from DB, compare `answer` vs `correctAnswer`
  - If wrong: call hearts deduction (Feature 05)
  - If lesson complete (all exercises submitted):
    - `prisma.lessonProgress.upsert({ status: "completed", score, xpEarned })`
    - Award XP + gems (Feature 05)
    - Update streak (Feature 05)
    - Unlock next lesson
  - Return `{ correct, explanation, xpEarned, lessonComplete }`

### Step 3 — Answer validation utilities
- [ ] Create `lib/exercise/validate.ts`
  - `validateAnswer(exercise: Exercise, answer: unknown): boolean`
  - Per-type logic:
    - `multiple_choice`, `true_false`: strict equality
    - `fill_blank`: lowercase + trim
    - `ordering`: array deep-equal
    - `matching`: set of pairs match
    - `code_fill_blank`: normalize whitespace, then compare

### Step 4 — Lesson unlock logic
- [ ] Create `lib/exercise/unlock.ts`
  - `unlockNextLesson(lessonId: string, userId: string): Promise<void>`
  - Find next lesson by order within chapter
  - If no next lesson in chapter: find first lesson of next chapter
  - `prisma.lessonProgress.upsert({ status: "available" })`

### Step 5 — Exercise hook
- [ ] Create `hooks/useExercise.ts`
  - State: `currentIndex`, `answers`, `results`, `isComplete`
  - `submitAnswer(exerciseId, answer)` → POST to submit API, update state
  - Derived: `hearts` (from useHearts), `progress` percentage

### Step 6 — Exercise UI components
- [ ] `components/exercise/ProgressBar.tsx`
  - Shows `currentIndex / total` as filled segments
- [ ] `components/exercise/HeartDisplay.tsx`
  - Renders N heart icons, filled/empty based on current hearts
- [ ] `components/exercise/ExerciseScreen.tsx`
  - Orchestrates: shows current exercise type component, feedback overlay, progress bar, heart display
  - On complete → show ResultScreen
- [ ] `components/exercise/ResultScreen.tsx`
  - XP earned, accuracy %, streak status, "Continue" button

### Step 7 — Individual exercise type components
- [ ] `components/exercise/types/MultipleChoice.tsx`
  - 2×2 button grid; selected option highlighted; confirm button
- [ ] `components/exercise/types/TrueFalse.tsx`
  - Two buttons (True / False); immediate submit on click
- [ ] `components/exercise/types/FillBlank.tsx`
  - Sentence with `___` replaced by `<input>`; submit button
- [ ] `components/exercise/types/Matching.tsx`
  - Two columns; click left item → click right item to pair; drag & drop optional
- [ ] `components/exercise/types/Ordering.tsx`
  - Draggable list items; drag & drop to reorder; submit button
- [ ] `components/exercise/types/CodeFillBlank.tsx`
  - Monaco editor (light, read-only surrounding code, editable blank sections)
  - Submit button with diff check

### Step 8 — Lesson page
- [ ] `app/(app)/learn/[courseId]/lesson/[lessonId]/page.tsx`
  - Server component: fetch lesson + exercises
  - Pass to `ExerciseScreen` client component

---

## Acceptance Criteria
- [ ] All 6 exercise types render and accept input correctly
- [ ] Correct answer → green feedback + explanation shown → progress advances
- [ ] Wrong answer → red feedback + 1 heart deducted → stays on same exercise (or moves on)
- [ ] Completing all exercises → ResultScreen with correct XP total
- [ ] Next lesson unlocked in DB after completion
- [ ] Hearts at 0 → blocking modal shown before submitting next answer
