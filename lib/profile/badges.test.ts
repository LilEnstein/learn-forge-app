import { describe, it, expect } from "vitest";
import { deriveBadges } from "./badges";

const baseData = {
  streakRecord: { currentStreak: 0, longestStreak: 0 },
  lessonProgress: [] as { score: number | null }[],
  courseStats: [] as { completed: number; total: number }[],
  leagueEntries: [] as { promoted: boolean }[],
};

describe("deriveBadges", () => {
  it("all badges locked when no activity", () => {
    const badges = deriveBadges(baseData);
    expect(badges.every((b) => !b.earned)).toBe(true);
  });

  it("streak7 earned at 7+ days", () => {
    const badges = deriveBadges({ ...baseData, streakRecord: { currentStreak: 7, longestStreak: 7 } });
    expect(badges.find((b) => b.id === "streak7")?.earned).toBe(true);
    expect(badges.find((b) => b.id === "streak30")?.earned).toBe(false);
  });

  it("perfect score badge earned when any lesson has score 100", () => {
    const badges = deriveBadges({ ...baseData, lessonProgress: [{ score: 100 }] });
    expect(badges.find((b) => b.id === "perfect")?.earned).toBe(true);
  });

  it("perfect score badge NOT earned for score 99", () => {
    const badges = deriveBadges({ ...baseData, lessonProgress: [{ score: 99 }] });
    expect(badges.find((b) => b.id === "perfect")?.earned).toBe(false);
  });

  it("course complete badge earned when completed === total", () => {
    const badges = deriveBadges({ ...baseData, courseStats: [{ completed: 5, total: 5 }] });
    expect(badges.find((b) => b.id === "course_complete")?.earned).toBe(true);
  });

  it("league promoted badge earned from any promoted entry", () => {
    const badges = deriveBadges({ ...baseData, leagueEntries: [{ promoted: true }] });
    expect(badges.find((b) => b.id === "promoted")?.earned).toBe(true);
  });
});
