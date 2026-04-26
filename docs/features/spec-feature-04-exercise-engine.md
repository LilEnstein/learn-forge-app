# Feature 04 — Exercise Engine

## Overview
The in-lesson exercise screen presents exercises one by one, collects answers, gives immediate feedback, deducts hearts on wrong answers, and awards XP/gems on lesson completion.

---

## User Stories
- As a user, I see exercises one at a time with a progress bar at the top
- As a user, I receive immediate feedback (correct/wrong + explanation) after answering
- As a user, I lose 1 heart each time I answer incorrectly
- As a user, when I complete all exercises, I see a result screen with XP earned and streak update
- As a user, if I run out of hearts mid-lesson, I am blocked and shown recovery options

---

## Exercise Screen Flow
```
Enter lesson → show exercises one by one (progress bar top)
→ user answers → immediate feedback (correct/wrong + explanation)
→ if wrong: lose 1 heart
→ all exercises done → Result screen (XP earned, streak, summary)
```

---

## 6 Exercise Types

| Type | Description | Render |
|---|---|---|
| `multiple_choice` | 1 question, 4 options | 2×2 button grid |
| `fill_blank` | Fill in the blank inline | Inline input |
| `matching` | Connect pairs (term ↔ definition) | Drag & drop two columns |
| `ordering` | Sort steps in correct order | Drag & drop vertical list |
| `code_fill_blank` | Complete code snippet | Mini code editor (Monaco lite) |
| `true_false` | True / False + explanation | 2 buttons |

---

## Submit Flow
```
POST /api/lessons/{id}/submit
Body: { exerciseId, answer, timeSpentMs }

Server:
1. Validate answer against correctAnswer
2. Calculate score
3. If lesson complete: update LessonProgress
4. Calculate XP, gems, update gamification
5. Check and update streak
6. Return: { correct, explanation, xpEarned, lessonComplete }
```

---

## XP & Gem Rewards
```
Standard lesson completion:         +10 XP, +0 gems
Perfect score (no mistakes):        +15 XP, +5 gems
Checkpoint lesson completion:       +25 XP, +15 gems
```

---

## Database Models

```prisma
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
```

---

## API Routes
```
GET  /api/lessons/:id            # Fetch lesson + exercises
POST /api/lessons/:id/submit     # Submit answer, update progress
```

---

## Key Files
```
app/(app)/learn/[courseId]/lesson/[lessonId]/page.tsx
components/exercise/
  ExerciseScreen.tsx         # Main exercise container
  ProgressBar.tsx
  HeartDisplay.tsx
  ResultScreen.tsx
  types/
    MultipleChoice.tsx
    FillBlank.tsx
    Matching.tsx
    Ordering.tsx
    CodeFillBlank.tsx
    TrueFalse.tsx
hooks/
  useExercise.ts             # Exercise state machine (current exercise, answers, hearts)
```

---

## Answer Validation Logic (server-side)
| Exercise Type | Validation |
|---|---|
| `multiple_choice` | Exact string match |
| `true_false` | Boolean match |
| `fill_blank` | Case-insensitive trim match |
| `ordering` | Array order match |
| `matching` | Set of pair matches |
| `code_fill_blank` | Normalized whitespace string match |

---

## Lesson Progress Unlock Logic
- First lesson of a course: `available` by default
- Subsequent lessons unlock when previous lesson reaches `completed`
- Checkpoint lessons unlock only when all preceding lessons in the chapter are `completed`
