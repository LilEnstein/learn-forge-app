# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
## Project Specification Authority

The file `learnforge-app-spec.md` is the single source of truth for this project.

You MUST follow these rules strictly:

- Always read and align with `learnforge-app-spec.md` before generating any code, architecture, or suggestions.
- Never contradict the specifications defined in `learnforge-app-spec.md`.
- If a request conflicts with the spec, explicitly point out the conflict and prioritize the spec.
- When implementing features, ensure full compliance with the requirements, constraints, and design decisions in `learnforge-app-spec.md`.
- If the spec is unclear or incomplete, ask for clarification instead of making assumptions.
- Continuously reference the spec when reasoning, designing, or modifying any part of the system.

## Enforcement Behavior

- Treat `learnforge-app-spec.md` as a system-level constraint.
- Do not generate solutions that deviate from the spec, even if they seem technically better, unless explicitly instructed.
- When explaining decisions, reference relevant parts of the spec.

## Context Loading

- Always assume `learnforge-app-spec.md` is part of the active context.
- If it is not loaded, request to load or access it before proceeding.

---

## Implementation Plan

Feature specs and plans live in `docs/features/`. Each feature has:
- `spec-feature-XX-name.md` — requirements, DB models, API routes, env vars
- `plan-feature-XX-name.md` — step-by-step implementation checklist with acceptance criteria

### Stack Contracts
- Use Next.js App Router only. No Pages Router.
- Use Server Actions for form mutations; API routes only when external clients need them.
- All API inputs validated with Zod at the route boundary.
- All LLM outputs validated with Zod before DB writes.
- All routes under `/api/*` (except `auth/*`) require an authenticated session — call `getSession()` on the first line.
- Throw typed errors (`InsufficientGemsError`, etc.); a single error middleware maps them to HTTP status codes.

### Chunk Order & Dependencies

```
Chunk 0 (Foundation)
  → Chunk 1 (Auth)
    → Chunk 2 (Knowledge Pipeline: Upload + RAG + Curriculum)
      → Chunk 3 (Core Learning Loop: Exercise Engine + basic XP/Streak)  ← MVP
        ├─► Chunk 4 (Full Gamification: Hearts, Gems, Quests, League, Shop)
        ├─► Chunk 5 (Learning Map UI)
        ├─► Chunk 6 (Remaining Exercise Types: Matching, Ordering, CodeFillBlank)
        └─► Chunk 7 (AI Companion)
              → Chunk 8 (Profile & Statistics)
```

After Chunk 3 the project is a working MVP. Chunks 4–8 can be done in any order or in parallel branches.

### Chunk Summaries

| Chunk | Features | Key Output |
|---|---|---|
| 0 — Foundation | Project init, Prisma full schema, Docker, env | `npm run dev` boots, migrations pass |
| 1 — Auth | Feature 01 | sign up → login → onboarding → dashboard |
| 2 — Knowledge Pipeline | Features 02 + 03 | upload PDF → chunks in DB → course with exercises |
| 3 — Core Loop (MVP) | Feature 04 + Feature 05 (XP + basic streak only) | complete lesson → XP awarded → next lesson unlocks |
| 4 — Full Gamification | Rest of Feature 05 | hearts, gems, daily quests, shop, league, cron jobs |
| 5 — Learning Map UI | Feature 06 | zigzag map renders, nodes animate, preview modal works |
| 6 — Remaining Exercises | Feature 04 (matching, ordering, code_fill_blank) | all 6 exercise types functional |
| 7 — AI Companion | Feature 07 | streaming RAG-grounded chat, proactive notifications |
| 8 — Profile & Stats | Feature 08 | heatmap, XP chart, badges, leaderboard |

### Per-Chunk Workflow Rules
1. Read the relevant `plan-feature-XX.md` before writing any code.
2. State a brief plan (steps + verify checks) before starting.
3. Implement one sub-step at a time. Stop after each. Verify before moving on.
4. Run real checks (curl, click, query DB) — don't accept "looks good" without evidence.
5. Commit per sub-step, not per chunk.

### Verification Gates

| After Chunk | Gate |
|---|---|
| 0 | `prisma migrate dev` clean; `npm run dev` starts without errors |
| 1 | OAuth round-trip works; unauthenticated access to `/app/*` redirects to `/login` |
| 2 | Real PDF → ≥20 chunks in DB → curriculum has ≥3 chapters → exercises have `sourceChunkId` |
| 3 | Complete a lesson → correct XP → streak = 1 → next lesson status = "available" |
| 4 | Hearts drain and refill; cron resets streak; gem spend fails gracefully when balance is 0 |
| 5 | Map renders 20+ nodes on mobile without jank; lesson preview modal opens correctly |
| 7 | Companion only returns content from the authenticated user's own documents |
| 8 | Heatmap day counts match `LessonProgress.completedAt` rows in DB |

### Anti-Patterns
- Do not implement more than one chunk's scope in a single session.
- Do not skip the pg-boss queue and run ingestion synchronously (breaks on Vercel's 10s limit).
- Do not let `lib/ai/provider.ts` shape drift per file — design it once in Chunk 2 and freeze it.
- Do not generate exercises before validating the curriculum JSON schema end-to-end.
- Do not add try/catch around code the framework already wraps.