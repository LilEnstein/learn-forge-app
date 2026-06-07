# Step-Cluster Plan — Feature 13: MarkItDown Document Parsing Layer

> Execution view of [plan-feature-13-markitdown-parser.md](./plan-feature-13-markitdown-parser.md).
> The plan lists 6 linear steps; this groups them into **3 clusters** with dependency order, parallelism, and a hard exit gate per cluster. Do not start a cluster until the previous cluster's **Exit Gate** is green.

---

## Dependency Graph

```
Cluster A — FOUNDATION (env + module, no behavior change yet)
   Step 0  install markitdown ─┐
   Step 1  env vars ───────────┤ (0 and 1 are independent → parallel)
   Step 2  markitdown.ts ──────┘ (needs env names from Step 1)
        │
        ▼  Exit Gate A
Cluster B — INTEGRATION (wire into pipeline)
   Step 3  ingest.ts edit  (needs Step 2 module)
        │
        ▼  Exit Gate B  ← REGRESSION GATE (most important)
Cluster C — VERIFICATION (lock it in)
   Step 4  unit tests ──┐ (4 and 5 independent → parallel)
   Step 5  build+smoke ─┘
        │
        ▼  Exit Gate C → DONE
```

**Critical path:** Step 1 → Step 2 → Step 3 → Step 5.
**Off-critical-path (can run anytime after its dep):** Step 0 (any time before first real upload), Step 4 (any time after Step 2).

---

## Cluster A — Foundation

**Goal:** markitdown installed + a standalone, tested-by-hand conversion module exist. **Zero change to app behavior yet** — `ingest.ts` still untouched, so nothing can regress.

| Step | Task | Parallel? |
|---|---|---|
| 0 | `pip install "markitdown[all]"`; verify `markitdown --version`; write `docs/setup/MARKITDOWN-SETUP.md` | ‖ with Step 1 |
| 1 | Add `MARKITDOWN_ENABLED` / `MARKITDOWN_BIN` / `MARKITDOWN_TIMEOUT_MS` to `.env.example` + `.env.local` | ‖ with Step 0 |
| 2 | Create `lib/upload/markitdown.ts` (`isMarkItDownAvailable`, `convertWithMarkItDown`, `__resetMarkItDownCache`) | after Step 1 |

**Build order within cluster:** run Step 0 and Step 1 together, then Step 2 (it reads the env var *names* defined in Step 1).

### Exit Gate A (all must pass before Cluster B)
- [ ] `markitdown --version` exits 0 in the **same shell** `next dev` runs in.
- [ ] `lib/upload/markitdown.ts` compiles (`npx tsc --noEmit` clean, or no red in IDE).
- [ ] Manual one-shot proof: a throwaway `tsx` call to `convertWithMarkItDown(fs.readFileSync('sample.docx'),'sample.docx')` prints Markdown. **Delete the throwaway after.**
- [ ] `markitdown.ts` imports **nothing** from `parser.ts` (independence check).

> If markitdown can't be installed on this machine, you can still proceed — `isMarkItDownAvailable()` will return false and the whole feature degrades to the existing parsers. But then Cluster C's "new formats" smoke tests can't be checked locally. Note it and move on.

---

## Cluster B — Integration

**Goal:** route parsing through markitdown with automatic fallback to `parseBuffer()`. This is the only cluster that changes runtime behavior.

| Step | Task | Parallel? |
|---|---|---|
| 3 | Edit `lib/upload/ingest.ts`: import the module, replace the parse block (lines ~28–40), swap `parsed.text` → `text` downstream | sequential (single file) |

**Touch boundary (hard limit):** only the parse block + the `parsed.text` references below it. Do **not** touch chunk/embed/curriculum/emit logic, `parser.ts`, `chunker.ts`, schema, or routes.

### Exit Gate B — REGRESSION GATE (do not skip; this is where conflicts would show)
Run all three, observing `[ingest] parsed via …` logs and final document status:

- [ ] **Fallback path (forced off):** set `MARKITDOWN_ENABLED="false"` → upload a known-good **PDF** → log says `parsed via fallback` → document reaches `ready`, `DocumentChunk` rows created exactly as before this feature. *(Proves zero regression to today's behavior.)*
- [ ] **markitdown path:** unset/restore `MARKITDOWN_ENABLED` → upload a `.pptx` → log says `parsed via markitdown` → `ready`. *(Proves new formats work.)*
- [ ] **markitdown path, existing format:** upload a `.docx` → `parsed via markitdown` → `ready`. *(Proves DOCX now flows through markitdown without breaking.)*

> If the forced-off PDF test does **not** behave identically to pre-feature, **stop** — the integration broke the fallback contract. Fix before Cluster C.

---

## Cluster C — Verification

**Goal:** lock the behavior with automated tests and a full build, then a 4-format smoke pass.

| Step | Task | Parallel? |
|---|---|---|
| 4 | `lib/upload/markitdown.test.ts` — mock `node:child_process`, cover availability + convert + fallback cases (style: `vitest`, like `lib/gamification/hearts.test.ts`) | ‖ with Step 5 |
| 5 | `npm run build` (type/bundle safety) + dev smoke of `.pdf`/`.docx`/`.pptx`/`.html` + DB chunk check | ‖ with Step 4 |

**Note:** Steps 4 and 5 are independent — run in either order or together. Step 4 only needs the Step 2 module; Step 5 needs the Step 3 integration.

### Test matrix for Step 4 (each = one `it()`)
| Case | Setup | Expect |
|---|---|---|
| disabled flag | `MARKITDOWN_ENABLED="false"` | `isMarkItDownAvailable()` → false |
| serverless | `process.env.VERCEL="1"` | `isMarkItDownAvailable()` → false |
| binary missing | spawn emits `error` | `isMarkItDownAvailable()` → false |
| available | `--version` close code 0 | `isMarkItDownAvailable()` → true |
| convert ok | stdout has data, code 0 | returns the string |
| convert bad exit | code ≠ 0 | returns `null` |
| convert spawn throws | spawn throws | returns `null` |

> Call `__resetMarkItDownCache()` in `beforeEach` so the in-process availability cache doesn't leak between cases.

### Exit Gate C → DONE
- [ ] `npm run test` green (all new cases pass).
- [ ] `npm run build` succeeds (no type error; `child_process` import doesn't break the bundle — it's server-only via `ingest.ts`).
- [ ] Smoke: `.pdf`, `.docx`, `.pptx`, `.html` all reach `ready`; SSE log shows the parser used for each.
- [ ] DB: `DocumentChunk` rows exist for each of the 4 uploads.

---

## One-Shot Command Flow (happy path, dev machine)

```bash
# Cluster A
pip install "markitdown[all]"
markitdown --version                       # expect: version + exit 0
#  → add 3 env vars to .env.example + .env.local
#  → create lib/upload/markitdown.ts

# Cluster B
#  → edit lib/upload/ingest.ts (parse block + parsed.text→text)

# Cluster B gate (regression)
#  set MARKITDOWN_ENABLED=false, upload PDF  → expect "parsed via fallback", ready
#  unset, upload .pptx                       → expect "parsed via markitdown", ready
#  upload .docx                              → expect "parsed via markitdown", ready

# Cluster C
#  → create lib/upload/markitdown.test.ts
npm run test                               # expect: green
npm run build                              # expect: success
#  smoke .pdf/.docx/.pptx/.html            → all ready, chunks present
```

---

## Commit Cadence (one per cluster boundary, mirrors plan's Commit Plan)

| After | Commit |
|---|---|
| Cluster A | `feat(parser): add markitdown availability + convert module (lib/upload/markitdown.ts)` + `docs(setup): add markitdown install guide + env vars` |
| Cluster B | `feat(ingest): route parsing through markitdown with parseBuffer fallback` |
| Cluster C | `test(parser): cover markitdown availability + fallback paths` |

---

## Rollback (any point)
- Fastest: `MARKITDOWN_ENABLED="false"` → instant return to legacy parsers, no code revert.
- Full: `git revert` the cluster commits (change surface is isolated to `lib/upload/` + docs + env).

---

## Non-Conflict Invariants (must hold at every cluster gate)
- [ ] No npm dependency added (`child_process` is built-in).
- [ ] `parser.ts`, `chunker.ts`, Prisma schema, API routes untouched.
- [ ] Production (Vercel) behavior unchanged — `VERCEL=1` short-circuits markitdown.
- [ ] Every markitdown failure (missing binary / timeout / weak output `< 100` chars) falls back; a document the legacy parser can handle never ends in `error` because of this feature.
