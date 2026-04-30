import { describe, it, expect } from "vitest";
import { calculateXp } from "./xp";

describe("calculateXp", () => {
  it("standard lesson, not perfect → 10 xp, 0 gems", () => {
    expect(calculateXp("standard", false)).toEqual({ xp: 10, gems: 0 });
  });

  it("standard lesson, perfect → 15 xp, 5 gems", () => {
    expect(calculateXp("standard", true)).toEqual({ xp: 15, gems: 5 });
  });

  it("checkpoint lesson → 25 xp, 15 gems regardless of perfect", () => {
    expect(calculateXp("checkpoint", false)).toEqual({ xp: 25, gems: 15 });
    expect(calculateXp("checkpoint", true)).toEqual({ xp: 25, gems: 15 });
  });
});
