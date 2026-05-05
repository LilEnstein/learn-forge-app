export class NoAiKeyError extends Error {
  constructor() {
    super("AI provider not configured")
    this.name = "NoAiKeyError"
  }
}

export class InvalidUserKeyError extends Error {
  constructor() {
    super("API key invalid — update in Settings")
    this.name = "InvalidUserKeyError"
  }
}

export class InvalidEnvKeyError extends Error {
  constructor() {
    super("Server AI configuration error")
    this.name = "InvalidEnvKeyError"
  }
}

// All keys belonging to the user are quota_exceeded. Distinct from
// QuotaExhaustedError: this is the no-fallback-available end state.
export class NoActiveKeyError extends Error {
  resetHint?: Date
  constructor(resetHint?: Date) {
    super("All API keys have hit their quota")
    this.name = "NoActiveKeyError"
    this.resetHint = resetHint
  }
}

// Single-key 429 with no fallback key to switch to.
export class QuotaExhaustedError extends Error {
  resetHint?: Date
  constructor(resetHint?: Date) {
    super("API quota exceeded — try again later")
    this.name = "QuotaExhaustedError"
    this.resetHint = resetHint
  }
}

export class KeyNotFoundError extends Error {
  constructor() {
    super("API key not found")
    this.name = "KeyNotFoundError"
  }
}
