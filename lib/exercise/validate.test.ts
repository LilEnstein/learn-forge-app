import { describe, it, expect } from "vitest";
import { validateAnswer } from "./validate";

const ex = (type: string, correctAnswer: unknown) => ({ type, correctAnswer });

describe("validateAnswer", () => {
  it("multiple_choice: exact match", () => {
    expect(validateAnswer(ex("multiple_choice", "B"), "B")).toBe(true);
    expect(validateAnswer(ex("multiple_choice", "B"), "A")).toBe(false);
  });

  it("true_false: boolean match", () => {
    expect(validateAnswer(ex("true_false", true), true)).toBe(true);
    expect(validateAnswer(ex("true_false", true), false)).toBe(false);
  });

  it("fill_blank: case-insensitive trim", () => {
    expect(validateAnswer(ex("fill_blank", "hello"), " Hello ")).toBe(true);
    expect(validateAnswer(ex("fill_blank", "hello"), "world")).toBe(false);
  });

  it("ordering: exact array order", () => {
    expect(validateAnswer(ex("ordering", [1, 2, 3]), [1, 2, 3])).toBe(true);
    expect(validateAnswer(ex("ordering", [1, 2, 3]), [1, 3, 2])).toBe(false);
  });

  it("matching: set of pairs", () => {
    const correct = [{ left: "A", right: "1" }, { left: "B", right: "2" }];
    const answer = [{ left: "B", right: "2" }, { left: "A", right: "1" }];
    expect(validateAnswer(ex("matching", correct), answer)).toBe(true);
    const wrong = [{ left: "A", right: "2" }, { left: "B", right: "1" }];
    expect(validateAnswer(ex("matching", correct), wrong)).toBe(false);
  });

  it("code_fill_blank: normalized whitespace", () => {
    expect(validateAnswer(ex("code_fill_blank", "return x + 1"), "return  x+1")).toBe(false);
    expect(validateAnswer(ex("code_fill_blank", "return x + 1"), "return x + 1")).toBe(true);
  });
});
