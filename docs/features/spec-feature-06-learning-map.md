# Feature 06 — Learning Map UI

## Overview
A Duolingo-style zigzag learning path that visualizes all lessons in a course. Nodes animate between locked/available/completed states. Users tap available nodes to preview and start lessons.

---

## User Stories
- As a user, I see all lessons in my course laid out as a winding path
- As a user, locked nodes appear dimmed; my next available node pulses to draw attention
- As a user, clicking an available node shows a preview modal (title, XP, estimated time) with a "Start" button
- As a user, clicking a completed node shows my previous result and a "Review" option
- As a user, I can visually distinguish standard lessons, checkpoints, and boss challenges

---

## Map Layout
- Path pattern: zigzag left-right (Duolingo style)
- Connections: animated path lines via Framer Motion
- Each chapter has a colored header strip separating its lessons
- Scroll: vertical, lessons stack top to bottom through chapters

---

## Node States
| State | Visual |
|---|---|
| `locked` | Dimmed, non-interactive |
| `available` | Full color, pulsing animation |
| `completed` | Full color + checkmark icon |

---

## Node Types
| Type | Shape | Color |
|---|---|---|
| Standard lesson | Circle | Topic color |
| Checkpoint | Star / Shield | Gold |
| Boss challenge (end of course) | Hexagon | Special accent |

---

## Interactions
- **Tap available node** → Preview modal → "Start" → navigate to exercise screen
- **Tap completed node** → Result summary modal → "Review" → exercise screen (review mode)
- **Tap locked node** → No action (or tooltip explaining prerequisite)

---

## Key Files
```
app/(app)/learn/[courseId]/page.tsx      # Learning map page
components/map/
  LearningMap.tsx                        # Main map container
  MapNode.tsx                            # Single lesson node (state-aware)
  MapConnector.tsx                       # Animated SVG path between nodes
  ChapterHeader.tsx                      # Chapter title strip
```

---

## Data Dependencies
The map page fetches:
```
GET /api/courses/:id
→ Course + chapters + lessons + LessonProgress (per user)
```

Node state derived from `LessonProgress.status` per lesson.

---

## Animation Notes
- Use **Framer Motion** for:
  - Path connector draw-in animation on mount
  - Available node pulse (scale + opacity loop)
  - Node unlock animation (locked → available transition)
- Keep animations performant: prefer CSS transforms over layout changes

---

## Accessibility
- Locked nodes: `aria-disabled="true"`
- Available nodes: `aria-label="{lesson title} — {xpReward} XP"`
- Completed nodes: include checkmark in accessible label
