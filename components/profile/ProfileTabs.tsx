"use client";

import { useState } from "react";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { XPChart } from "./XPChart";
import { BadgeGrid } from "./BadgeGrid";
import { CourseStatCard } from "./CourseStatCard";
import type { Badge } from "@/lib/profile/badges";

type Tab = "overview" | "stats" | "courses";

interface CourseStatItem {
  courseId: string;
  title: string;
  emoji: string;
  completed: number;
  total: number;
  accuracy: number | null;
}

interface Props {
  heatmap: { date: string; count: number }[];
  xpByWeek: { week: string; xp: number }[];
  badges: Badge[];
  courseStats: CourseStatItem[];
  currentStreak: number;
  longestStreak: number;
  questSummary?: { completed: number; total: number } | null;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "stats",    label: "Stats" },
  { id: "courses",  label: "Courses" },
];

export function ProfileTabs({
  heatmap, xpByWeek, badges, courseStats, currentStreak, longestStreak, questSummary,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <ActivityHeatmap data={heatmap} />
          <BadgeGrid badges={badges} />
          {questSummary && (
            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm font-semibold mb-1">Nhiệm vụ hôm nay</p>
              <p className="text-sm text-muted-foreground">
                {questSummary.completed}/{questSummary.total} nhiệm vụ hoàn thành
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "stats" && (
        <div className="space-y-6">
          <XPChart data={xpByWeek} />
          <div className="rounded-xl border bg-card p-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Streak hiện tại</p>
              <p className="text-2xl font-bold">🔥 {currentStreak}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Streak dài nhất</p>
              <p className="text-2xl font-bold">{longestStreak} ngày</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "courses" && (
        <div className="space-y-3">
          {courseStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Chưa có khóa học nào.</p>
          ) : (
            courseStats.map((c) => (
              <CourseStatCard
                key={c.courseId}
                emoji={c.emoji}
                title={c.title}
                completed={c.completed}
                total={c.total}
                accuracy={c.accuracy}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
