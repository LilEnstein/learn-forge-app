# MarkItDown Setup (Feature 13)

MarkItDown is an **external Python CLI** the ingest pipeline shells out to. It
is optional: when absent, the pipeline falls back to the legacy parsers
(`lib/upload/parser.ts`). No npm dependency is added.

## Requirements

- Python ≥ 3.10 (verified here: `python --version` → `Python 3.11.0`).
- `markitdown` CLI on the same `PATH` that `next dev` runs in.

## Install

```bash
pip install "markitdown[all]"
markitdown --version          # expect: "markitdown 0.1.6" (or newer), exit 0
```

## Environment variables

Add to `.env.example` and `.env.local`:

```bash
MARKITDOWN_ENABLED="true"     # set "false" to force legacy parsers (instant rollback)
MARKITDOWN_BIN="markitdown"   # binary name or absolute path
MARKITDOWN_TIMEOUT_MS="60000" # per-conversion hard timeout
```

## Windows / Anaconda notes (important)

On this dev machine markitdown is installed into the **Anaconda base env**
(`C:\Users\mm003\anaconda3`). Two gotchas were found during install:

1. **numpy/pandas binary mismatch.** The base env shipped `numpy 2.2.6` with a
   `pandas 2.0.3` compiled against numpy 1.x, which crashed markitdown's xlsx
   converter on import (`ValueError: numpy.dtype size changed`). Fixed with:
   ```bash
   pip install --upgrade "pandas>=2.2.2"
   ```
2. **Residual numpy-1.x C extensions** (`numexpr`, `bottleneck`, `pyarrow`)
   still print `_ARRAY_API not found` warnings to **stderr** on every run. These
   are harmless to us: markitdown writes Markdown to **stdout** and exits `0`,
   and our module reads stdout + exit code only. stderr is ignored. If you want
   a clean run, rebuild or downgrade those packages — not required for Feature 13.

## CLI invocation contract (markitdown 0.1.6)

The installed CLI changed its stdin convention from older docs:

- **stdin via a pipe produces empty output** (the old `cat file | markitdown -x .ext -`
  form returns exit 0 but **no Markdown**). This is why `lib/upload/markitdown.ts`
  does **not** stream the buffer over stdin.
- **Reliable path:** write the buffer to a temp file with the original extension
  and pass the file path: `markitdown <tempfile>` → Markdown on stdout, exit 0.
  The module cleans the temp file up afterward.

Verify by hand:

```bash
markitdown sample.docx                 # path form → prints Markdown ✓
cat sample.html | markitdown -x .html  # pipe form → EMPTY on 0.1.6 ✗
```

## Production (Vercel)

`isMarkItDownAvailable()` short-circuits to `false` when `VERCEL="1"` — serverless
has no Python. Production always uses the legacy parsers; nothing to install there.
