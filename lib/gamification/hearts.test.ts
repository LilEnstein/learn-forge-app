import { describe, it, expect } from "vitest";
import { computeHearts } from "./hearts";

describe("computeHearts", () => {
  it("full hearts → no refill needed", () => {
    const result = computeHearts({ hearts: 5, maxHearts: 5, lastHeartAt: null });
    expect(result).toEqual({ hearts: 5, nextRefillAt: null });
  });

  it("no lastHeartAt and hearts < max → hearts unchanged, no nextRefillAt", () => {
    const result = computeHearts({ hearts: 3, maxHearts: 5, lastHeartAt: null });
    expect(result).toEqual({ hearts: 3, nextRefillAt: null });
  });

  it("refills 1 heart after 31 min", () => {
    const lastHeartAt = new Date(Date.now() - 31 * 60 * 1000);
    const result = computeHearts({ hearts: 3, maxHearts: 5, lastHeartAt });
    expect(result.hearts).toBe(4);
    expect(result.nextRefillAt).not.toBeNull();
  });

  it("refills 2 hearts after 65 min", () => {
    const lastHeartAt = new Date(Date.now() - 65 * 60 * 1000);
    const result = computeHearts({ hearts: 2, maxHearts: 5, lastHeartAt });
    expect(result.hearts).toBe(4);
  });

  it("caps at maxHearts", () => {
    const lastHeartAt = new Date(Date.now() - 200 * 60 * 1000);
    const result = computeHearts({ hearts: 1, maxHearts: 5, lastHeartAt });
    expect(result.hearts).toBe(5);
    expect(result.nextRefillAt).toBeNull();
  });
});
