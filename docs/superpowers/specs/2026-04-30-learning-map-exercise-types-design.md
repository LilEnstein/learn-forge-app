# Design: Learning Map UI (Chunk 5) + Remaining Exercise Types (Chunk 6)

**Date:** 2026-04-30  
**Status:** Approved

---

## Overview

**Chunk 5** replaces the existing plain-list course page with a Duolingo-style zigzag learning map. Nodes alternate left/right down the page, connected by vertical lines, separated by chapter header strips. Framer Motion drives available-node pulse and bottom-sheet entrance. No new API routes — all data is already fetched server-side on the course page.

**Chunk 6** upgrades `CodeFillBlank` with prismjs syntax highlighting on surrounding code context. The `pre+input` structure is preserved; only the text parts gain highlighted HTML. Matching and Ordering are already complete and need no changes.

---

## Chunk 5 — Learning Map UI

### Architecture

**Approach:** Server page + pure client map component.

`app/app/learn/[courseId]/page.tsx` (server component) fetches course + chapters + lessons + user progress, then passes data as props to `<LearningMap>`. No new API routes. No client-side fetch.

### Data Shape Passed to LearningMap

```ts
interface MapLesson {
  id: string;
  title: string;
  type: "standard" | "checkpoint";
  order: number;
  xpReward: number;
  exerciseCount: number;       // count of exercises for display in preview sheet
  status: "locked" | "available" | "completed";
  chapterId: string;
  chapterTitle: string;        // for chapter header rendering
}
```

The server page fetches `exercises: { select: { id: true } }` on each lesson to derive `exerciseCount`.

### Component Tree

```
app/app/learn/[courseId]/page.tsx   (server)
  └── <LearningMap lessons={...} courseId={...} />   (client)
        ├── <ChapterHeader />         — colored strip per chapter
        ├── <MapNode />               — one per lesson
        │     └── (pulse animation)
        ├── <connector div />         — between each pair of nodes
        └── <LessonPreviewSheet />    — bottom sheet, one instance
```

### LearningMap.tsx

- Receives `lessons: MapLesson[]` and `courseId: string`
- Computes zigzag side: `side = index % 2 === 0 ? "left" : "right"`
- Renders chapter headers by detecting when `chapterId` changes between adjacent items
- Renders connector between `lessons[i]` and `lessons[i+1]` using look-ahead:
  ```ts
  const nextLesson = lessons[index + 1];
  const connectorIsAmber = nextLesson?.type === "checkpoint";
  ```
- Owns `selectedLesson: MapLesson | null` state; passes setter to each `MapNode`
- Renders `<LessonPreviewSheet>` once at root with `lesson={selectedLesson}`

### MapNode.tsx

**Props:** `lesson: MapLesson`, `side: "left" | "right"`, `onClick`

State is read as `lesson.status` — not a separate prop.

**Layout:**
- `side === "left"` → `ml-8`
- `side === "right"` → `ml-auto mr-8`

**Node shapes:**

| Type | Shape | CSS |
|---|---|---|
| `standard` | Circle | `rounded-full` |
| `checkpoint` | Hexagon | `clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)` |

**Node state styles:**

| State | Standard | Checkpoint |
|---|---|---|
| `locked` | Gray `bg-muted`, `🔒`, dim (opacity 0.4), no animation | Gray hexagon, `🔒`, opacity 0.4 |
| `available` | Violet `bg-violet-600`, violet pulse animation | Amber gradient `#F59E0B→#D97706`, `🏆` white, amber pulse |
| `completed` | Violet `bg-violet-600`, `✓` checkmark | Gold gradient `#FCD34D→#F59E0B`, `⭐`, shimmer overlay |

**Shimmer on completed checkpoint:**
```css
@keyframes shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
/* Applied as a pseudo-overlay inside the hexagon div */
background: linear-gradient(90deg, #FCD34D 25%, #FBBF24 50%, #FCD34D 75%);
background-size: 200% auto;
animation: shimmer 3s linear infinite;
```

**Framer Motion — available node pulse:**
```tsx
// Standard
animate={{ boxShadow: ["0 0 0 0 rgba(124,58,237,0.5)", "0 0 0 12px rgba(124,58,237,0)", "0 0 0 0 rgba(124,58,237,0)"] }}
transition={{ duration: 2, repeat: Infinity }}

// Checkpoint
animate={{ boxShadow: ["0 0 0 0 rgba(245,158,11,0.7)", "0 0 0 12px rgba(245,158,11,0)", "0 0 0 0 rgba(245,158,11,0)"] }}
transition={{ duration: 2, repeat: Infinity }}
```
Only applied when `status === "available"`.

**Framer Motion — unlock transition:**
```tsx
initial={{ opacity: 0.3, scale: 0.9 }}
animate={{ opacity: status === "locked" ? 0.3 : 1, scale: status === "locked" ? 0.9 : 1 }}
transition={{ duration: 0.4 }}
```

**XP badge on checkpoint nodes:** Visible when `status !== "locked"`. Pure CSS: `opacity-0 group-hover:opacity-100 transition-opacity`. Shows `+{xpReward} XP` above the hexagon.

**Locked node click:** `onClick` is still called on locked nodes — `LearningMap` sets `selectedLesson`, the sheet opens, but the Start button is disabled with message "Complete the previous lesson to unlock."

### ChapterHeader.tsx

Colored strip rendered when `lessons[i].chapterId !== lessons[i-1]?.chapterId`.

```tsx
<div className="w-full rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide bg-violet-100 text-violet-700 my-4">
  {chapterTitle}
</div>
```

### Connector div

Between each pair of nodes. A 2px (standard) or 3px (into checkpoint) tall `div`:

```tsx
<div className={`mx-auto w-[2px] h-8 rounded-full ${
  nextIsCheckpoint ? "w-[3px] bg-amber-400" : "bg-violet-300"
}`} />
```

### LessonPreviewSheet.tsx

Single instance at the root of `LearningMap`. Uses `AnimatePresence`:

```tsx
<AnimatePresence>
  {selectedLesson && (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black/40 z-40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={() => setSelectedLesson(null)}
      />
      {/* Sheet */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 bg-card rounded-t-2xl p-6 z-50 shadow-2xl"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        <div className="w-8 h-1 bg-muted rounded-full mx-auto mb-4" />
        {/* Lesson info: title, type badge, XP badge, exercise count */}
        {/* Start button — disabled + message when status === "locked" */}
        <button onClick={() => router.push(`/app/learn/${courseId}/lesson/${lesson.id}`)}>
          Start Lesson →
        </button>
      </motion.div>
    </>
  )}
</AnimatePresence>
```

Start button when locked:
```tsx
<button disabled className="...opacity-50">Start Lesson →</button>
<p className="text-xs text-muted-foreground text-center mt-2">
  Complete the previous lesson to unlock
</p>
```

---

## Chunk 6 — CodeFillBlank prismjs Upgrade

### Scope

Only `components/exercise/types/CodeFillBlank.tsx` and `lib/ai/generators/schemas.ts` are modified. No new dependencies — prismjs is already installed.

### ExerciseSchema change

Add optional `language` field:
```ts
export const ExerciseSchema = z.object({
  // ... existing fields ...
  language: z.string().optional(),   // e.g. "javascript", "python", "sql", "typescript"
});
```

The AI generator prompt for `code_fill_blank` exercises should include `"language": "javascript"` in its output. Default is `"javascript"` when absent.

### CodeFillBlank.tsx changes

**Language loading (useEffect before highlight):**
```ts
async function loadLanguage(lang: string) {
  switch (lang) {
    case "python":     await import("prismjs/components/prism-python"); break;
    case "sql":        await import("prismjs/components/prism-sql"); break;
    case "typescript": await import("prismjs/components/prism-typescript"); break;
    case "bash":       await import("prismjs/components/prism-bash"); break;
    // "javascript" is statically imported — no case needed
  }
}
```

Called in `useEffect([language])` before setting highlight state.

**Highlight with guard:**
```ts
const safeLanguage = Prism.languages[language] ? language : "javascript";
const highlighted = part?.trim()
  ? Prism.highlight(part, Prism.languages[safeLanguage], safeLanguage)
  : "";
```

**Render:**
```tsx
<span dangerouslySetInnerHTML={{ __html: highlighted }} />
```
(instead of the current plain text `{part}`)

**Import:**
```ts
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-javascript";
```

### Global CSS fix (app/globals.css)

Add to prevent double background (Prism theme vs Tailwind `bg-muted`):
```css
code[class*="language-"],
pre[class*="language-"] {
  background: transparent !important;
}
```

---

## File Map

### New files
```
components/map/LearningMap.tsx
components/map/MapNode.tsx
components/map/ChapterHeader.tsx
components/map/LessonPreviewSheet.tsx
```

### Modified files
```
app/app/learn/[courseId]/page.tsx         — replace list JSX with <LearningMap />; add exerciseCount fetch
components/exercise/types/CodeFillBlank.tsx — add prismjs highlighting
lib/ai/generators/schemas.ts              — add language field to ExerciseSchema
app/globals.css                           — add prism background override
```

---

## Out of Scope

- Boss challenge node type (not in DB schema — `type` only has `standard` | `checkpoint`)
- Review mode when tapping completed nodes (navigation to lesson still works; no separate review API)
- Mobile bottom-sheet swipe-to-dismiss gesture (web `onClick` backdrop dismiss is sufficient for now)
- Curved SVG connectors (straight CSS verticals + zigzag offset achieves the winding path feel)
