# Feature 08 — Profile & Statistics

## Overview
A public profile page showing user identity, learning stats, activity heatmap, XP trends, badge collection, and per-course progress metrics.

---

## User Stories
- As a user, I can view my profile with avatar, display name, level, and league badge
- As a user, I can see my activity heatmap (like GitHub contribution graph)
- As a user, I can see my XP trend over the past weeks as a chart
- As a user, I can see badges I've earned and badges still locked
- As a user, I can view per-course stats: lessons completed, accuracy rate, avg daily study time

---

## Profile Page Sections

### Identity
- Avatar (uploaded or Gravatar fallback)
- Display name
- Level badge (derived from totalXp)
- League badge (current league tier)

### Activity Heatmap
- Monthly calendar grid
- Each day colored by activity intensity (lessons completed)
- Similar to GitHub contribution graph

### XP Chart
- Weekly XP bar chart (last 8 weeks)
- Built with **recharts**

### Badge Collection
- Grid of earned badges (full color) and locked badges (greyscale)
- Badge types: streak milestones, perfect scores, course completions, league promotions

### Streak History
- Current streak count
- Longest streak record
- Freeze usage history

---

## Per-Course Stats
| Metric | Description |
|---|---|
| Completion | Lessons completed / total lessons |
| Accuracy | % of correct first-attempt answers |
| Daily avg | Average minutes studied per active day |

---

## API Routes
```
GET /api/profile/:userId     # Public profile data
GET /api/leaderboard?courseId=   # Weekly league leaderboard (also used in gamification)
```

---

## Key Files
```
app/(app)/profile/page.tsx        # Own profile
app/(app)/leaderboard/page.tsx    # League leaderboard
components/
  (no dedicated component folder; uses recharts + shadcn/ui)
```

---

## Data Sources
| Section | Data From |
|---|---|
| Identity | User model |
| Gamification | UserGamification model |
| Streak | StreakRecord model |
| League | LeagueEntry model |
| Heatmap | LessonProgress.completedAt aggregated by day |
| XP Chart | Transaction model (earn_xp type) aggregated by week |
| Badges | Derived from milestones (StreakRecord, LessonProgress, LeagueEntry) |
| Course stats | LessonProgress per course |
