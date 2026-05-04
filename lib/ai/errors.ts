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
