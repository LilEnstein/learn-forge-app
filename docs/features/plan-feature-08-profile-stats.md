# Plan — Feature 08: Profile & Statistics

## Prerequisites
- Feature 05 (Gamification) complete — UserGamification, StreakRecord, LeagueEntry, Transaction data
- Feature 04 (Exercise Engine) — LessonProgress data with completedAt timestamps

---

## Implementation Steps

### Step 1 — Profile API route
- [ ] `app/api/profile/[userId]/route.ts` (GET)
  - Fetch: User, UserGamification, StreakRecord, LeagueEntry (current week)
  - Fetch: LessonProgress grouped by course (completion count, accuracy)
  - Fetch: Transaction (earn_xp) grouped by ISO week (last 8 weeks)
  - Fetch: LessonProgress.completedAt grouped by day (last 12 months, for heatmap)
  - Return combined profile object
  - Public route (no auth required for viewing)

### Step 2 — Badge derivation logic
- [ ] Create `lib/profile/badges.ts`
  - `deriveBadges(userId): Promise<Badge[]>` — scans milestones and returns earned/locked list
  - Badge sources:
    - Streak milestones: 7, 30, 100 days
    - Perfect score: ≥ 1 lesson with 100% accuracy
    - Course completion: ≥ 1 course fully completed
    - League promotion: LeagueEntry with `promoted: true`

### Step 3 — Activity heatmap component
- [ ] `components/profile/ActivityHeatmap.tsx`
  - Props: `data: { date: string, count: number }[]`
  - Renders 12-month grid (week columns × day rows)
  - Color intensity: 0 = grey, 1 = light green, 2+ = darker greens
  - Tooltip on hover showing date + lessons completed

### Step 4 — XP chart component
- [ ] `components/profile/XPChart.tsx`
  - Props: `data: { week: string, xp: number }[]`
  - Recharts `BarChart` — 8-week history
  - X-axis: week labels; Y-axis: XP

### Step 5 — Badge grid component
- [ ] `components/profile/BadgeGrid.tsx`
  - Props: `badges: Badge[]`
  - Earned badges: full color with title
  - Locked badges: greyscale with lock icon overlay

### Step 6 — Stats cards
- [ ] `components/profile/CourseStatCard.tsx`
  - Props: `courseTitle, completed, total, accuracy, avgDailyMinutes`
  - Progress bar + stat labels

### Step 7 — Profile page
- [ ] `app/(app)/profile/page.tsx` (own profile)
  - Fetches `/api/profile/[currentUserId]`
  - Sections: Identity → Streak → Daily Quests → Activity Heatmap → XP Chart → Badges → Course Stats
- [ ] `app/(app)/profile/[userId]/page.tsx` (public profile view)
  - Same layout, no edit controls

### Step 8 — Leaderboard page
- [ ] `app/(app)/leaderboard/page.tsx`
  - Fetches `GET /api/leaderboard?courseId=`
  - Shows ranked table: rank, avatar, name, weekly XP, league badge
  - Highlights current user's row
  - Tab switcher: filter by course topic

---

## Acceptance Criteria
- [ ] Profile page loads without error for own user
- [ ] Heatmap shows correct activity for past 12 months
- [ ] XP chart bars match Transaction history for each week
- [ ] Earned badges appear in full color; locked badges greyscale
- [ ] Course stats show accurate completion % and accuracy rate
- [ ] Public profile is accessible without authentication
- [ ] Leaderboard shows correct weekly XP ranking

---

## Dependencies to Install
```bash
npm install recharts
npm install -D @types/recharts
```
