"use client";

import { useQuery } from "@tanstack/react-query";

export interface GamificationData {
  streak: number;
  longestStreak: number;
  hearts: number;
  maxHearts: number;
  nextRefillAt: string | null;
  gems: number;
  totalXp: number;
  weeklyXp: number;
  streakFreezes: number;
  quests: Array<{
    id: string;
    progress: number;
    completed: boolean;
    quest: {
      type: string;
      title: string;
      description: string;
      target: number;
      gemReward: number;
    };
  }>;
}

export function useGamification() {
  return useQuery<GamificationData>({
    queryKey: ["gamification"],
    queryFn: async () => {
      const res = await fetch("/api/gamification/me");
      if (!res.ok) throw new Error("Failed to fetch gamification");
      return res.json();
    },
  });
}
