# Learning Map UI + Exercise Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat course page list with an animated zigzag learning map (Chunk 5) and upgrade CodeFillBlank with prismjs syntax highlighting (Chunk 6).

**Architecture:** Server component fetches all data and passes a flat `MapLesson[]` array to a client `<LearningMap>` component. Map renders zigzag with CSS offsets, Framer Motion pulse/slide animations, and a single bottom-sheet instance. CodeFillBlank keeps pre+input structure; prismjs highlights the surrounding code text only.

**Tech Stack:** Next.js 14 App Router, Framer Motion 11 (already installed), prismjs (already installed), Tailwind CSS, TypeScript, Prisma 5.

**Design doc:** `docs/superpowers/specs/2026-04-30-learning-map-exercise-types-design.md`

---

## File Map

### New files
```
components/map/ChapterHeader.tsx       — colored chapter title strip
components/map/MapNode.tsx             — single lesson node (circle or hexagon, all states)
components/map/LessonPreviewSheet.tsx  — Framer Motion bottom sheet with Start button
components/map/LearningMap.tsx         — zigzag orchestrator; owns selectedLesson state
```

### Modified files
```
app/app/learn/[courseId]/page.tsx           — replace list JSX with <LearningMap>; extend Prisma query
lib/ai/generators/schemas.ts               — add optional language field to ExerciseSchema
components/exercise/types/CodeFillBlank.tsx — add prismjs highlighting
app/globals.css                             — add prism background: transparent override
```

---

## Task 1: ChapterHeader component

**Files:**
- Create: `components/map/ChapterHeader.tsx`

- [ ] **Step 1: Create `components/map/ChapterHeader.tsx`**

```tsx
interface Props {
  title: string;
}

export function ChapterHeader({ title }: Props) {
  return (
    <div className="w-full rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide bg-violet-100 text-violet-700 my-4">
      {title}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add components/map/ChapterHeader.tsx
git commit -m "feat(map): ChapterHeader component"
```

---

## Task 2: MapNode component

**Files:**
- Create: `components/map/MapNode.tsx`

This is the most complex map component. It renders either a circle (standard) or hexagon (checkpoint), handles all three states (locked/available/completed), and uses Framer Motion for the pulse and unlock transition.

- [ ] **Step 1: Create `components/map/MapNode.tsx`**

```tsx
"use client";

import { motion } from "framer-motion";

export interface MapLesson {
  id: string;
  title: string;
  type: "standard" | "checkpoint";
  order: number;
  xpReward: number;
  exerciseCount: number;
  status: "locked" | "available" | "completed";
  chapterId: string;
  chapterTitle: string;
}

interface Props {
  lesson: MapLesson;
  side: "left" | "right";
  onClick: (lesson: MapLesson) => void;
}

const NODE_SIZE = 56;

export function MapNode({ lesson, side, onClick }: Props) {
  const { status, type } = lesson;
  const isCheckpoint = type === "checkpoint";
  const isLocked = status === "locked";
  const isAvailable = status === "available";
  const isCompleted = status === "completed";

  // Pulse animation only when available
  const pulseAnimate = isAvailable
    ? isCheckpoint
      ? {
          boxShadow: [
            "0 0 0 0 rgba(245,158,11,0.7)",
            "0 0 0 12px rgba(245,158,11,0)",
            "0 0 0 0 rgba(245,158,11,0)",
          ],
        }
      : {
          boxShadow: [
            "0 0 0 0 rgba(124,58,237,0.5)",
            "0 0 0 12px rgba(124,58,237,0)",
            "0 0 0 0 rgba(124,58,237,0)",
          ],
        }
    : {};

  const nodeBackground = isLocked
    ? "#e5e7eb"
    : isCheckpoint
    ? isCompleted
      ? undefined // shimmer class handles background for completed checkpoint
      : "linear-gradient(135deg, #F59E0B, #D97706)"
    : "#7c3aed";

  const nodeStyle: React.CSSProperties = {
    width: NODE_SIZE,
    height: NODE_SIZE,
    ...(nodeBackground ? { background: nodeBackground } : {}),
    ...(isCheckpoint
      ? { clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }
      : { borderRadius: "50%" }),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    cursor: isLocked ? "default" : "pointer",
    flexShrink: 0,
    position: "relative",
  };

  // Shimmer class applied to completed checkpoint nodes (CSS defined in globals.css)
  const shimmerClass = isCheckpoint && isCompleted ? "checkpoint-shimmer" : "";

  const icon = isLocked ? "🔒" : isCompleted ? (isCheckpoint ? "⭐" : "✓") : isCheckpoint ? "🏆" : "📘";

  return (
    <div
      className={`flex ${side === "right" ? "justify-end pr-8" : "justify-start pl-8"}`}
    >
      <div className="relative group">
        {/* XP badge — checkpoint only, visible when not locked */}
        {isCheckpoint && !isLocked && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold text-amber-600 whitespace-nowrap">
            +{lesson.xpReward} XP
          </div>
        )}

        <motion.div
          className={shimmerClass}
          style={nodeStyle}
          animate={{
            opacity: isLocked ? 0.4 : 1,
            scale: isLocked ? 0.9 : 1,
            ...pulseAnimate,
          }}
          transition={
            isAvailable
              ? { boxShadow: { duration: 2, repeat: Infinity }, opacity: { duration: 0.4 }, scale: { duration: 0.4 } }
              : { duration: 0.4 }
          }
          onClick={() => onClick(lesson)}
          whileHover={!isLocked ? { scale: 1.08 } : undefined}
        >
          <span style={{ color: isLocked ? "#9ca3af" : "white", fontSize: isCompleted && !isCheckpoint ? 20 : 22 }}>
            {icon}
          </span>
        </motion.div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/map/MapNode.tsx
git commit -m "feat(map): MapNode with circle/hexagon shapes and Framer Motion states"
```

---

## Task 3: LessonPreviewSheet component

**Files:**
- Create: `components/map/LessonPreviewSheet.tsx`

- [ ] **Step 1: Create `components/map/LessonPreviewSheet.tsx`**

```tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import type { MapLesson } from "./MapNode";

interface Props {
  lesson: MapLesson | null;
  courseId: string;
  onClose: () => void;
}

export function LessonPreviewSheet({ lesson, courseId, onClose }: Props) {
  const router = useRouter();
  const isLocked = lesson?.status === "locked";

  function handleStart() {
    if (!lesson || isLocked) return;
    router.push(`/app/learn/${courseId}/lesson/${lesson.id}`);
  }

  return (
    <AnimatePresence>
      {lesson && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 bg-card rounded-t-2xl p-6 z-50 shadow-2xl max-w-2xl mx-auto"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Handle */}
            <div className="w-8 h-1 bg-muted rounded-full mx-auto mb-6" />

            {/* Lesson info */}
            <div className="flex items-start gap-4 mb-4">
              <div className="text-3xl">{lesson.type === "checkpoint" ? "🏆" : "📘"}</div>
              <div className="flex-1">
                <p className="font-bold text-lg leading-tight">{lesson.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {lesson.type === "checkpoint" ? "Checkpoint" : "Standard lesson"} · {lesson.exerciseCount} exercises
                </p>
              </div>
            </div>

            {/* Badges */}
            <div className="flex gap-2 mb-6">
              <span className="bg-violet-100 text-violet-700 text-xs font-semibold px-3 py-1 rounded-full">
                +{lesson.xpReward} XP
              </span>
              {lesson.type === "checkpoint" && (
                <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full">
                  Checkpoint
                </span>
              )}
              {lesson.status === "completed" && (
                <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                  ✓ Completed
                </span>
              )}
            </div>

            {/* Start button */}
            <button
              onClick={handleStart}
              disabled={isLocked}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {lesson.status === "completed" ? "Review Lesson" : "Start Lesson →"}
            </button>

            {isLocked && (
              <p className="text-xs text-muted-foreground text-center mt-3">
                Complete the previous lesson to unlock
              </p>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/map/LessonPreviewSheet.tsx
git commit -m "feat(map): LessonPreviewSheet bottom sheet with AnimatePresence"
```

---

## Task 4: LearningMap orchestrator

**Files:**
- Create: `components/map/LearningMap.tsx`

- [ ] **Step 1: Create `components/map/LearningMap.tsx`**

```tsx
"use client";

import { useState } from "react";
import { MapNode, type MapLesson } from "./MapNode";
import { ChapterHeader } from "./ChapterHeader";
import { LessonPreviewSheet } from "./LessonPreviewSheet";

interface Props {
  lessons: MapLesson[];
  courseId: string;
  courseEmoji: string;
  courseTitle: string;
  completedCount: number;
  totalCount: number;
}

export function LearningMap({ lessons, courseId, courseEmoji, courseTitle, completedCount, totalCount }: Props) {
  const [selectedLesson, setSelectedLesson] = useState<MapLesson | null>(null);

  return (
    <div className="max-w-sm mx-auto pb-32">
      {/* Course header */}
      <div className="mb-8">
        <p className="text-4xl mb-2">{courseEmoji}</p>
        <h1 className="text-2xl font-bold">{courseTitle}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {completedCount}/{totalCount} lessons completed
        </p>
        <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all"
            style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : "0%" }}
          />
        </div>
      </div>

      {/* Zigzag map */}
      <div className="flex flex-col">
        {lessons.map((lesson, index) => {
          const prevLesson = lessons[index - 1];
          const nextLesson = lessons[index + 1];
          const side: "left" | "right" = index % 2 === 0 ? "left" : "right";
          const showChapterHeader = lesson.chapterId !== prevLesson?.chapterId;
          // Connector shown below this node (between this and next lesson)
          const showConnector = index < lessons.length - 1;
          const connectorIsAmber = nextLesson?.type === "checkpoint";

          return (
            <div key={lesson.id}>
              {showChapterHeader && (
                <ChapterHeader title={lesson.chapterTitle} />
              )}

              <MapNode
                lesson={lesson}
                side={side}
                onClick={setSelectedLesson}
              />

              {showConnector && (
                <div
                  className={`mx-auto rounded-full ${connectorIsAmber ? "bg-amber-400" : "bg-violet-300"}`}
                  style={{ width: connectorIsAmber ? 3 : 2, height: 32 }}
                />
              )}
            </div>
          );
        })}
      </div>

      <LessonPreviewSheet
        lesson={selectedLesson}
        courseId={courseId}
        onClose={() => setSelectedLesson(null)}
      />
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/map/LearningMap.tsx
git commit -m "feat(map): LearningMap zigzag orchestrator"
```

---

## Task 5: Wire up course page

**Files:**
- Modify: `app/app/learn/[courseId]/page.tsx`

Replace the existing list JSX with `<LearningMap>`. The key changes to the Prisma query: add `xpReward` and `exercises: { select: { id: true } }` to the lesson select so we can pass `exerciseCount` to the map.

- [ ] **Step 1: Replace `app/app/learn/[courseId]/page.tsx`**

```tsx
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { LearningMap, type MapLesson } from "@/components/map/LearningMap";

// Re-export MapLesson from LearningMap so the server page can use it
// (MapLesson is defined in MapNode.tsx; LearningMap re-exports it)

interface Props {
  params: { courseId: string };
}

export default async function CoursePage({ params }: Props) {
  const session = await requireSession();
  const userId = session.user.id!;
  const { courseId } = params;

  const course = await prisma.course.findUnique({
    where: { id: courseId, userId },
    include: {
      chapters: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              type: true,
              order: true,
              xpReward: true,
              _count: { select: { exercises: true } },
            },
          },
        },
      },
    },
  });

  if (!course) notFound();

  const lessonIds = course.chapters.flatMap((ch) => ch.lessons.map((l) => l.id));
  const progressRows = await prisma.lessonProgress.findMany({
    where: { userId, lessonId: { in: lessonIds } },
    select: { lessonId: true, status: true },
  });
  const progressMap = new Map(progressRows.map((p) => [p.lessonId, p.status]));

  // Build flat MapLesson[] across all chapters
  const mapLessons: MapLesson[] = course.chapters.flatMap((ch) =>
    ch.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      type: l.type as "standard" | "checkpoint",
      order: l.order,
      xpReward: l.xpReward,
      exerciseCount: l._count.exercises,
      status: (progressMap.get(l.id) ?? "locked") as "locked" | "available" | "completed",
      chapterId: ch.id,
      chapterTitle: ch.title,
    }))
  );

  const completedCount = mapLessons.filter((l) => l.status === "completed").length;

  return (
    <LearningMap
      lessons={mapLessons}
      courseId={courseId}
      courseEmoji={course.emoji}
      courseTitle={course.title}
      completedCount={completedCount}
      totalCount={mapLessons.length}
    />
  );
}
```

Note: `LearningMap.tsx` currently imports `MapLesson` from `./MapNode`. We need to re-export it from `LearningMap.tsx` so this server page can import it cleanly. Add this line to `components/map/LearningMap.tsx`:

```tsx
export type { MapLesson } from "./MapNode";
```

- [ ] **Step 2: Add the re-export to `components/map/LearningMap.tsx`**

At the top of `LearningMap.tsx`, after the existing imports, add:

```tsx
export type { MapLesson } from "./MapNode";
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 4: Smoke test in browser**

```bash
npm run dev
```

Navigate to a course URL (e.g. `/app/learn/<courseId>`). Verify:
- Zigzag layout renders with nodes alternating left/right
- Completed lessons show `✓` (violet circle), available lessons pulse, locked lessons are dimmed
- Chapter headers appear between chapters
- Tapping any node opens the bottom sheet with lesson title, XP, exercise count
- Tapping "Start Lesson →" on an available node navigates to the lesson page
- Tapping the backdrop closes the sheet
- Locked node sheet shows disabled Start button + "Complete the previous lesson to unlock"

- [ ] **Step 5: Commit**

```bash
git add app/app/learn/[courseId]/page.tsx components/map/LearningMap.tsx
git commit -m "feat(map): wire course page to LearningMap zigzag"
```

---

## Task 6: ExerciseSchema — add language field

**Files:**
- Modify: `lib/ai/generators/schemas.ts`

- [ ] **Step 1: Add `language` field to `ExerciseSchema`**

In `lib/ai/generators/schemas.ts`, replace the existing `ExerciseSchema`:

```ts
export const ExerciseSchema = z.object({
  type: z.enum(["multiple_choice", "fill_blank", "true_false"]),
  question: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctAnswer: z.union([z.string(), z.array(z.string()), z.boolean()]),
  explanation: z.string().optional(),
  difficulty: z.number().int().min(1).max(3).default(1),
  language: z.string().optional(), // for code_fill_blank: "javascript" | "python" | "sql" | "typescript" | "bash"
});
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/generators/schemas.ts
git commit -m "feat(schema): add optional language field to ExerciseSchema for code_fill_blank"
```

---

## Task 7: CodeFillBlank prismjs upgrade

**Files:**
- Modify: `components/exercise/types/CodeFillBlank.tsx`

- [ ] **Step 1: Replace `components/exercise/types/CodeFillBlank.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-javascript";

interface Props {
  question: string;
  language?: string;
  onSubmit: (answer: string) => void;
  disabled: boolean;
}

async function loadLanguage(lang: string): Promise<void> {
  switch (lang) {
    case "python":
      await import("prismjs/components/prism-python");
      break;
    case "sql":
      await import("prismjs/components/prism-sql");
      break;
    case "typescript":
      await import("prismjs/components/prism-typescript");
      break;
    case "bash":
      await import("prismjs/components/prism-bash");
      break;
    // "javascript" is statically imported above — no case needed
  }
}

function highlightPart(part: string, language: string): string {
  const safeLanguage = Prism.languages[language] ? language : "javascript";
  return part?.trim()
    ? Prism.highlight(part, Prism.languages[safeLanguage], safeLanguage)
    : "";
}

export function CodeFillBlank({ question, language = "javascript", onSubmit, disabled }: Props) {
  const parts = question.split("___");
  const blankCount = parts.length - 1;
  const [values, setValues] = useState<string[]>(Array(blankCount).fill(""));
  const [highlightedParts, setHighlightedParts] = useState<string[]>(parts.map(() => ""));

  useEffect(() => {
    let cancelled = false;
    async function highlight() {
      await loadLanguage(language);
      if (cancelled) return;
      setHighlightedParts(parts.map((p) => highlightPart(p, language)));
    }
    highlight();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, question]);

  function updateValue(i: number, v: string) {
    setValues((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  }

  function buildAnswer(): string {
    return parts.reduce((acc, part, i) => acc + part + (values[i] ?? ""), "");
  }

  const allFilled = values.every((v) => v.trim().length > 0);

  return (
    <div className="space-y-6">
      <p className="text-xl font-semibold">Complete the code</p>
      <pre className="bg-muted rounded-xl p-4 text-sm font-mono whitespace-pre-wrap overflow-x-auto">
        {parts.map((part, i) => (
          <span key={i}>
            {highlightedParts[i] ? (
              <span dangerouslySetInnerHTML={{ __html: highlightedParts[i] }} />
            ) : (
              part
            )}
            {i < parts.length - 1 && (
              <input
                type="text"
                value={values[i]}
                onChange={(e) => updateValue(i, e.target.value)}
                disabled={disabled}
                className="inline-block bg-yellow-100 border-b-2 border-yellow-400 outline-none px-1 font-mono text-sm min-w-[60px]"
                style={{ width: `${Math.max((values[i] ?? "").length + 4, 8)}ch` }}
              />
            )}
          </span>
        ))}
      </pre>
      <button
        disabled={!allFilled || disabled}
        onClick={() => onSubmit(buildAnswer())}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold disabled:opacity-50"
      >
        Check
      </button>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/exercise/types/CodeFillBlank.tsx
git commit -m "feat(exercise): add prismjs syntax highlighting to CodeFillBlank"
```

---

## Task 8: Global CSS prism background override

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add prism background override to `app/globals.css`**

Append after the last closing brace in `app/globals.css`:

```css
/* Neutralize prism-tomorrow background so Tailwind bg-muted is used instead */
code[class*="language-"],
pre[class*="language-"] {
  background: transparent !important;
}

/* Shimmer animation for completed checkpoint nodes on the learning map */
@keyframes shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}

.checkpoint-shimmer {
  background: linear-gradient(90deg, #FCD34D 25%, #FBBF24 50%, #FCD34D 75%) !important;
  background-size: 200% auto !important;
  animation: shimmer 3s linear infinite;
}
```

- [ ] **Step 2: TypeScript + build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Smoke test CodeFillBlank**

Start the dev server and navigate to a lesson with a `code_fill_blank` exercise. Verify:
- Code context is syntax-highlighted (keywords are colored)
- The `<pre>` background matches the surrounding `bg-muted` (no dark box)
- Input blanks still appear with yellow highlight
- Submitting the filled-in answer works as before

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "fix(styles): neutralize prism-tomorrow background in code blocks"
```

---

## Task 9: Final verification

- [ ] **Step 1: TypeScript full check**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: no output.

- [ ] **Step 2: Run all unit tests**

```bash
npx vitest run --reporter=verbose
```

Expected: 14/14 tests pass (validate, xp, hearts).

- [ ] **Step 3: Full browser smoke test**

With `npm run dev` running, verify end-to-end:

1. `/app/dashboard` → click a course card → loads zigzag map
2. Map shows alternating left/right nodes, chapter headers, connector lines
3. Available node pulses with violet glow; checkpoint available node pulses amber
4. Tap available node → bottom sheet slides up with lesson title, XP, exercise count, "Start Lesson →"
5. Tap Start → lesson page loads correctly
6. Tap locked node → sheet opens, Start button disabled, "Complete the previous lesson to unlock"
7. Tap backdrop → sheet closes
8. Navigate to a lesson with `code_fill_blank` exercise → code is highlighted, blanks are yellow inputs
9. `/app/shop`, `/app/leaderboard` still load without errors

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Learning Map UI (Chunk 5) + CodeFillBlank prismjs (Chunk 6)"
```
