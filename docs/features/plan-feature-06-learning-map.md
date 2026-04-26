# Plan — Feature 06: Learning Map UI

## Prerequisites
- Feature 03 (Curriculum) complete — chapters, lessons, and LessonProgress data exist
- Feature 05 (Gamification) — XP rewards surfaced in lesson preview
- Framer Motion installed

---

## Implementation Steps

### Step 1 — Course detail API
- [ ] Ensure `app/api/courses/[id]/route.ts` (GET) returns:
  ```typescript
  {
    course: Course,
    chapters: (Chapter & {
      lessons: (Lesson & { progress: LessonProgress | null })[]
    })[]
  }
  ```
  Scoped to authenticated user's progress

### Step 2 — Data hook
- [ ] Create `hooks/useLearningMap.ts`
  - SWR/fetch for `GET /api/courses/:id`
  - Returns `{ chapters, isLoading, error }`
  - Computes `nodeState` for each lesson: `"locked" | "available" | "completed"`

### Step 3 — MapConnector component
- [ ] `components/map/MapConnector.tsx`
  - Renders an SVG `<path>` connecting two node centers
  - Framer Motion `pathLength` animation: animates from 0 → 1 on mount
  - Props: `fromPos`, `toPos`, `completed: boolean`
  - Completed connector: full color; incomplete: muted

### Step 4 — MapNode component
- [ ] `components/map/MapNode.tsx`
  - Props: `lesson`, `state: "locked" | "available" | "completed"`, `onClick`
  - Renders shape by lesson type:
    - `standard` → circle
    - `checkpoint` → star/shield SVG
    - Boss (last lesson of course) → hexagon
  - State-based styling:
    - `locked`: opacity 40%, no pointer events
    - `available`: full opacity + Framer Motion pulsing scale animation
    - `completed`: full color + checkmark icon overlay
  - `onClick` fires only when state is `available` or `completed`

### Step 5 — ChapterHeader component
- [ ] `components/map/ChapterHeader.tsx`
  - Props: `chapter`, `color` (assigned per chapter index)
  - Renders chapter title in a colored banner strip
  - Used as separator between chapter groups of nodes

### Step 6 — LearningMap component
- [ ] `components/map/LearningMap.tsx`
  - Iterates chapters → lessons in order
  - Applies zigzag layout: alternating left/center/right column per node
  - Places ChapterHeader before each chapter's first node
  - Places MapConnector between consecutive nodes
  - Positions nodes absolutely within a fixed-width container using calculated coords
  - On node click: set `selectedLesson` state

### Step 7 — Lesson preview modal
- [ ] Inline or separate `LessonPreviewModal` component (shadcn Dialog)
  - Shows: lesson title, type badge, XP reward, estimated time ("~5 min")
  - Available node → "Start" button → navigate to `/learn/[courseId]/lesson/[lessonId]`
  - Completed node → "Results" summary + "Review" button

### Step 8 — Learning map page
- [ ] `app/(app)/learn/[courseId]/page.tsx`
  - Server component: fetch course data
  - Pass to `LearningMap` client component
  - Show skeleton loader while data is loading

---

## Acceptance Criteria
- [ ] All lessons render in correct zigzag order across chapters
- [ ] Chapter headers visually separate chapter groups
- [ ] Locked nodes are non-interactive; available node pulses
- [ ] Completed nodes show checkmark icon
- [ ] Clicking available node opens preview modal with correct XP info
- [ ] "Start" navigates to correct lesson URL
- [ ] Framer Motion path connectors animate on page load
- [ ] Map scrolls smoothly on mobile viewport

---

## Dependencies to Install
```bash
npm install framer-motion
```
