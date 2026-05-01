import { describe, it, expect } from "vitest";
import { parseCompanionContext } from "./useCompanionContext";

describe("parseCompanionContext", () => {
  it("parses lesson route", () => {
    expect(parseCompanionContext("/app/learn/course-123/lesson/lesson-456")).toEqual({
      type: "lesson",
      courseId: "course-123",
      lessonId: "lesson-456",
    });
  });

  it("parses map route", () => {
    expect(parseCompanionContext("/app/learn/course-123")).toEqual({
      type: "map",
      courseId: "course-123",
    });
  });

  it("returns general for dashboard", () => {
    expect(parseCompanionContext("/app/dashboard")).toEqual({ type: "general" });
  });

  it("returns general for unknown routes", () => {
    expect(parseCompanionContext("/app/profile")).toEqual({ type: "general" });
  });
});
