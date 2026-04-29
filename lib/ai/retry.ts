/**
 * Retry a Gemini/OpenAI/Ollama call on transient errors (429, 5xx).
 * Non-retryable errors (4xx other than 429) bubble up immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  const retries = opts.retries ?? 4;
  const baseDelayMs = opts.baseDelayMs ?? 1000;
  const label = opts.label ?? "ai";

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = extractStatus(err);
      const retryable = status === 429 || (status !== undefined && status >= 500 && status < 600);
      if (!retryable || attempt === retries) throw err;
      const delay = baseDelayMs * 2 ** attempt + Math.random() * 250;
      console.warn(
        `[retry:${label}] status ${status} on attempt ${attempt + 1}/${retries + 1} — waiting ${Math.round(delay)}ms`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

function extractStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as { status?: number; response?: { status?: number } };
  return e.status ?? e.response?.status;
}

function isRetryableStatus(status: number | undefined): boolean {
  return status === 429 || (status !== undefined && status >= 500 && status < 600);
}

/**
 * Try each model in `models` in order. Each model gets `withRetry` for transient errors;
 * if it still fails with a retryable error after all retries, fall through to the next model.
 * Non-retryable errors (4xx other than 429) bubble up immediately.
 */
export async function withModelFallback<T>(
  models: string[],
  call: (model: string) => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  if (models.length === 0) throw new Error("withModelFallback: empty model list");
  const label = opts.label ?? "ai";
  let lastErr: unknown;
  for (let i = 0; i < models.length; i++) {
    const modelName = models[i];
    try {
      return await withRetry(() => call(modelName), {
        retries: opts.retries,
        baseDelayMs: opts.baseDelayMs,
        label: `${label}:${modelName}`,
      });
    } catch (err) {
      lastErr = err;
      const status = extractStatus(err);
      if (!isRetryableStatus(status) || i === models.length - 1) throw err;
      console.warn(
        `[fallback:${label}] ${modelName} exhausted retries (status ${status}); trying ${models[i + 1]}`
      );
    }
  }
  throw lastErr;
}
