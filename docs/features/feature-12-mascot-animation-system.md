# Feature 12 — Mascot Animation System

**Status:** Complete  
**Priority:** Medium  
**Milestone:** v0.3 Full UI  
**Files:** `components/mascot/`, `components/dashboard/DashboardMascot.tsx`, `hooks/useMascot.ts`, `lib/mascot-animations.ts`, `lib/mascot-triggers.ts`, `types/mascot.ts`

---

## 1. Tổng quan

LearnForge có mascot là một chú cú tím (owl) xuất hiện tại các điểm quan trọng trong hành trình học tập — phản ứng theo từng hành động của user để tạo cảm giác "người bạn đồng hành", tăng engagement và retention.

### Assets — 12 PNG files tại `public/mascot/`

| File | Expression ID | Dùng khi |
|------|--------------|---------|
| `front.png` | `front` | Default / idle |
| `three-quarter.png` | `three-quarter` | Dashboard / welcome screen |
| `side.png` | `side` | Đang upload tài liệu |
| `top-down.png` | `top-down` | Đang học / generate curriculum |
| `happy.png` | `happy` | Trả lời đúng |
| `thinking.png` | `thinking` | Đang xử lý / generate / AI thinking |
| `surprised.png` | `surprised` | Trả lời sai / có lỗi |
| `sleeping.png` | `sleeping` | User idle >5 phút |
| `victory.png` | `victory` | Hoàn thành lesson / streak / upload done |
| `streak-warning.png` | `streak-warning` | Streak sắp mất |
| `welcome.png` | `welcome` | Onboarding / lần đầu vào app |
| `notebook.png` | *(standalone UI asset)* | Không dùng trong mascot component |

> Kích thước gốc: 236×205px, transparent background. Được serve trực tiếp qua `next/image` với auto-optimize WebP.

---

## 2. Kiến trúc

```
types/
└── mascot.ts                    # MascotExpression, MascotAnimation, MascotSize, MascotTrigger, MascotProps

lib/
├── mascot-animations.ts         # MASCOT_ANIMATIONS: Record<MascotAnimation, AnimationConfig>
└── mascot-triggers.ts           # TRIGGER_MAP: Record<MascotTrigger, {expression, animation, message}>

hooks/
└── useMascot.ts                 # Zustand store — react(), show(), hide()

components/mascot/
├── Mascot.tsx                   # Root component: next/image + motion.div
├── MascotBubble.tsx             # Mascot + speech bubble (typewriter, auto-dismiss)
├── MascotFloat.tsx              # Fixed-corner widget (reads from Zustand, no prop drilling)
└── MascotOverlay.tsx            # Full-screen celebration overlay + confetti

public/mascot/
└── {expression}.png             # 11 expression PNGs + notebook.png
```

---

## 3. Types (`types/mascot.ts`)

```typescript
type MascotExpression =
  | 'front' | 'three-quarter' | 'side' | 'top-down'
  | 'happy' | 'thinking' | 'surprised' | 'sleeping'
  | 'victory' | 'streak-warning' | 'welcome'

type MascotAnimation =
  | 'bounce' | 'shake' | 'pulse' | 'spin' | 'float'
  | 'entrance' | 'exit' | 'wiggle' | 'nod'

type MascotSize = 'sm' | 'md' | 'lg' | 'xl'
//               48px  80px  120px  200px

type MascotTrigger =
  | 'correct' | 'incorrect' | 'perfect' | 'lesson_complete'
  | 'upload_processing' | 'upload_done' | 'upload_error'
  | 'streak_warning' | 'streak_milestone'
  | 'idle' | 'welcome' | 'thinking'
```

---

## 4. Animation Presets (`lib/mascot-animations.ts`)

Framer Motion v11 keyframe configs — spread trực tiếp lên `<motion.div>`.

| Animation | Keyframes | Transition |
|-----------|-----------|------------|
| `bounce` | `y: [0, -12, 0]` | 0.5s, repeat ∞, delay 2s |
| `shake` | `x: [0, -8, 8, -8, 8, 0]` | 0.4s easeInOut |
| `pulse` | `scale: [1, 1.05, 1]` | 2s repeat ∞ easeInOut |
| `spin` | `rotate: [0, 360]` | 0.6s easeOut |
| `float` | `y: [0, -8, 0]` | 3s repeat ∞ easeInOut |
| `entrance` | `y: 60→0, opacity: 0→1, scale: 0.8→1` | spring stiffness 300 damping 20 |
| `exit` | `scale→0, opacity→0` | 0.2s |
| `wiggle` | `rotate: [-5, 5, -5, 5, 0]` | 0.5s |
| `nod` | `rotateX: [0, 15, 0, 10, 0]` | 0.6s |

> Khi `loop=true` trên `<Mascot>`: tự động inject `repeat: Infinity` vào transition của các animation chưa có repeat.

---

## 5. Trigger Map (`lib/mascot-triggers.ts`)

| Trigger | Expression | Animation | Message |
|---------|-----------|-----------|---------|
| `correct` | `happy` | `nod` | "Chính xác! 🎉" |
| `incorrect` | `surprised` | `shake` | "Gần đúng rồi! Thử lại nhé" |
| `perfect` | `victory` | `spin` | "Hoàn hảo! +5 gems 💎" |
| `lesson_complete` | `victory` | `wiggle` | — |
| `upload_processing` | `thinking` | `pulse` | "Đang xử lý tài liệu..." |
| `upload_done` | `victory` | `entrance` | "Khóa học đã sẵn sàng! 🚀" |
| `upload_error` | `surprised` | `shake` | "Có lỗi xảy ra. Thử lại nhé!" |
| `streak_warning` | `streak-warning` | `bounce` | "Streak của bạn sắp mất! Học ngay!" |
| `streak_milestone` | `victory` | `spin` | — |
| `idle` | `sleeping` | `float` | "Bạn ổn không? 👀" |
| `welcome` | `welcome` | `entrance` | "Chào mừng đến LearnForge! 🦉" |
| `thinking` | `thinking` | `pulse` | — |

---

## 6. `useMascot` Hook (`hooks/useMascot.ts`)

Zustand store — global, không cần prop drilling.

```typescript
// Đọc state
const { expression, animation, message, visible } = useMascot()

// Trigger reactions
const { react, show, hide } = useMascot()

react('correct')                    // lookup TRIGGER_MAP → set state
show('top-down')                    // manual expression, no message
show('side', 'Đang đọc tài liệu…') // manual expression + message
hide()                              // visible = false
```

- `react()` và `show()` tự động schedule `message → null` sau 4000ms (debounced — trigger mới reset timer).
- State là global nên bất kỳ component nào cũng có thể fire trigger mà không cần truyền props.

---

## 7. Components

### `<Mascot>`

```tsx
<Mascot expression="happy" size="md" animate="nod" loop />
```

- Render `next/image` từ `/mascot/{expression}.png`
- Wrap bằng `<motion.div>` với animation spread từ `MASCOT_ANIMATIONS`
- `onError` fallback → emoji 🦉 nếu file không tồn tại

### `<MascotBubble>`

```tsx
<MascotBubble expression="happy" message="Chính xác! 🎉" onDismiss={fn} />
```

- Layout: mascot bên trái, bubble bên phải
- Bubble: `rounded-2xl bg-white shadow-lg border border-purple-100`
- Typewriter: từng ký tự hiện ra mỗi 30ms
- Auto-dismiss sau `autoHide` ms (mặc định 4000ms), hoặc khi user click

### `<MascotFloat>`

```tsx
<MascotFloat position="bottom-right" />   // Exercise Screen
<MascotFloat position="bottom-left" />    // Upload / Processing Screen
```

- **Tự đọc state từ Zustand** — không nhận expression/message qua props
- `pointer-events: none` khi không có message (không chặn UI)
- Khi có message → render `<MascotBubble>`, dismiss gọi `show(expression)` (giữ nguyên expression, xóa message)
- Khi không có message → render `<Mascot size="sm" loop>`
- Hiện/ẩn qua `AnimatePresence` + slide-up 0.3s

### `<MascotOverlay>`

```tsx
<MascotOverlay expression="victory" message="Hoàn hảo! +5 gems 💎" onClose={fn} />
```

- Full-screen overlay, backdrop blur 4px + `rgba(0,0,0,0.4)`
- Mascot `xl` (200px) với spring entrance + spin
- 20 confetti pieces (vàng / tím / cyan) rơi từ trên xuống với random delay
- Auto-close sau 3s hoặc khi user click

---

## 8. Tích hợp

### Dashboard (`app/app/dashboard/page.tsx` + `components/dashboard/DashboardMascot.tsx`)

Dashboard là server component nên mascot logic được đặt trong `DashboardMascot` (client component) nhận props từ server:

| Condition | Mascot action | Priority |
|-----------|--------------|----------|
| Lần đầu vào app (`localStorage` flag chưa set) | `react('welcome')` | 1 — highest |
| Streak còn sống, chưa học hôm nay, ≤2h đến nửa đêm | `react('streak_warning')` | 2 |
| `currentStreak ≥ 7` | `react('streak_milestone')` + `setMessage('🔥 N ngày...')` | 3 |
| Mặc định | `show('three-quarter')` | 4 — lowest |

Server tính `streakWarning` và `streakMilestone` dựa trên `StreakRecord.lastActivityDate` (format `YYYY-MM-DD`). Welcome flag dùng `localStorage` key `lf_mascot_welcomed` — chỉ fire một lần duy nhất trên thiết bị.

### Companion Chat (`components/companion/CompanionChat.tsx`)

| Event | Mascot action |
|-------|--------------|
| User gửi tin, streaming bắt đầu | `react('thinking')` → `thinking` + `pulse` |
| Streaming kết thúc | `show('front')` |

`<MascotFloat position="bottom-left" />` render trong CompanionChat (không che input box bên phải).

### Exercise Screen (`components/exercise/ExerciseScreen.tsx`)

| Event | Mascot action |
|-------|--------------|
| Mount | `show('top-down')` — owl đọc sách |
| Đáp án đúng | `react('correct')` → `happy` + `nod` |
| Đáp án sai | `react('incorrect')` → `surprised` + `shake` |
| Hoàn thành, 0 lỗi | `react('perfect')` + mount `<MascotOverlay>` |
| Hoàn thành, có lỗi | `react('lesson_complete')` → `victory` + `wiggle` |
| Idle >5 phút | `react('idle')` → `sleeping` + `float` |

Idle detection: `setTimeout(5min)` reset khi `mousemove` / `keydown` / `touchstart`. Cleanup đầy đủ trong `useEffect` return.

`<MascotFloat position="bottom-right" />` render ngoài layout chính.

### Upload / Processing Screen (`components/upload/ProcessingStatus.tsx`)

| SSE step | Mascot action |
|----------|--------------|
| `upload` | `show('side', 'Đang đọc tài liệu của bạn...')` |
| `parse` | `show('thinking', 'Đang phân tích nội dung...')` |
| `chunk` | `show('thinking')` *(no message — tránh spam)* |
| `embed` | `show('thinking', 'Đang tạo vector embedding...')` |
| `curriculum` | `show('top-down', 'Đang xây dựng lộ trình học...')` |
| `exercises` | `show('top-down', 'Đang tạo bài tập...')` |
| `done` | `react('upload_done')` → `victory` + `entrance` |
| `error` | `react('upload_error')` → `surprised` + `shake` |

`<MascotFloat position="bottom-left" />` — đặt bên trái để không che terminal log panel.

---

## 9. Acceptance Criteria

- [x] Mascot xuất hiện đúng expression khi trả lời đúng/sai trong exercise
- [x] Speech bubble typewriter effect hoạt động, auto-dismiss sau 4s
- [x] Perfect score trigger MascotOverlay với confetti
- [x] Idle detection sau 5 phút → sleeping owl, không có memory leak
- [x] Upload processing: mascot đổi expression theo từng bước pipeline
- [x] MascotFloat không chặn UI (pointer-events: none khi không có message)
- [x] AnimatePresence transition mượt khi đổi visible state
- [x] Fallback emoji 🦉 khi PNG không load được
- [x] Dashboard welcome mascot — lần đầu vào app (localStorage flag)
- [x] Streak warning mascot — khi streak alive nhưng chưa học hôm nay và còn ≤2h
- [x] Streak milestone mascot — khi currentStreak ≥ 7, hiển thị dynamic message
- [x] Companion Chat mascot — thinking khi streaming, front khi xong

---

## 10. Edge Cases

| Case | Xử lý |
|------|-------|
| Nhiều triggers cùng lúc | Trigger mới override ngay, message timer debounce reset |
| Lesson complete + idle cùng lúc | `isComplete` effect fire trước → lesson_complete/perfect được ưu tiên |
| PNG thiếu | `onError` ẩn `<img>` → render text "🦉" tại chỗ |
| Message dismiss sớm | `onDismiss` → `show(expression)` giữ mascot visible, xóa message |
| Bubble pointer-events | Chỉ bật khi `hasMessage = true` — mascot không bao giờ chặn nút submit |

---

## 11. `useMascot` API Reference

```typescript
// Zustand store — import anywhere, no prop drilling needed
const { expression, animation, message, visible } = useMascot()
const { react, show, hide, setMessage } = useMascot()

react('correct')                          // TRIGGER_MAP lookup → set state
show('top-down')                          // manual expression, no animation
show('side', 'Đang đọc tài liệu…')       // manual expression + message (auto-clear 4s)
setMessage('🔥 7 ngày liên tiếp!')       // override message only (dùng cho dynamic text)
hide()                                    // visible = false
```

Tất cả messages tự động clear sau 4000ms (debounced — trigger/show mới reset timer).
