export class InsufficientGemsError extends Error {
  readonly status = 400;
  constructor() { super("Insufficient gems"); this.name = "InsufficientGemsError"; }
}

export class NoFreezesError extends Error {
  readonly status = 400;
  constructor() { super("No streak freezes available"); this.name = "NoFreezesError"; }
}

export class NoHeartsError extends Error {
  readonly status = 403;
  constructor() { super("No hearts remaining"); this.name = "NoHeartsError"; }
}

export class LessonNotAvailableError extends Error {
  readonly status = 403;
  constructor() { super("Lesson is not available"); this.name = "LessonNotAvailableError"; }
}
