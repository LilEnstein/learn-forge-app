import { spawn } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";

const BIN = process.env.MARKITDOWN_BIN ?? "markitdown";
const TIMEOUT_MS = Number(process.env.MARKITDOWN_TIMEOUT_MS ?? 60000);

let availabilityCache: boolean | null = null;

/**
 * True only when: not disabled, not on Vercel (no Python in serverless), and
 * `markitdown --version` runs (exit 0). Cached per-process.
 */
export async function isMarkItDownAvailable(): Promise<boolean> {
  if (availabilityCache !== null) return availabilityCache;

  if (process.env.MARKITDOWN_ENABLED === "false") return (availabilityCache = false);
  if (process.env.VERCEL === "1") return (availabilityCache = false);

  availabilityCache = await new Promise<boolean>((resolve) => {
    try {
      const p = spawn(BIN, ["--version"]);
      p.on("error", () => resolve(false)); // binary missing
      p.on("close", (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
  return availabilityCache;
}

/**
 * Convert a buffer → Markdown by writing it to a temp file (preserving the
 * original extension) and invoking `markitdown <tempfile>`.
 *
 * Note: markitdown 0.1.6's stdin pipe mode returns empty output under Node's
 * spawn, so the buffer is passed as a file path instead. See
 * docs/setup/MARKITDOWN-SETUP.md.
 *
 * Returns null for ANY failure (caller falls back). Never throws.
 */
export async function convertWithMarkItDown(
  buffer: Buffer,
  fileName: string
): Promise<string | null> {
  const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
  const tmpPath = path.join(tmpdir(), `markitdown-${randomBytes(8).toString("hex")}${ext}`);

  try {
    await writeFile(tmpPath, buffer);
  } catch {
    return null;
  }

  try {
    return await new Promise<string | null>((resolve) => {
      let stdout = "";
      let settled = false;
      const done = (val: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(val);
      };

      let child;
      try {
        child = spawn(BIN, [tmpPath]);
      } catch {
        return done(null);
      }

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        done(null);
      }, TIMEOUT_MS);

      child.stdout.on("data", (d) => (stdout += d.toString("utf-8")));
      child.on("error", () => done(null));
      child.on("close", (code) => {
        const text = stdout.trim();
        done(code === 0 && text.length > 0 ? text : null);
      });
    });
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

/** Test-only: reset the in-process availability cache. */
export function __resetMarkItDownCache() {
  availabilityCache = null;
}
