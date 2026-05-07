"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MapNode, type MapLesson } from "./MapNode";
import { ChapterHeader } from "./ChapterHeader";
import { LessonPreviewSheet } from "./LessonPreviewSheet";

export type { MapLesson } from "./MapNode";

interface Props {
  lessons: MapLesson[];
  courseId: string;
  courseEmoji: string;
  courseTitle: string;
  completedCount: number;
  totalCount: number;
  highlightId?: string;
}

export function LearningMap({ lessons, courseId, courseEmoji, courseTitle, completedCount, totalCount, highlightId }: Props) {
  const [selectedLesson, setSelectedLesson] = useState<MapLesson | null>(null);

  useEffect(() => {
    if (!highlightId) return;
    const nodeEl = document.getElementById(`map-node-${highlightId}`);
    if (!nodeEl) return;
    nodeEl.scrollIntoView({ behavior: "smooth", block: "center" });
    nodeEl.classList.add("highlight-pulse");
    const timer = setTimeout(() => {
      nodeEl.classList.remove("highlight-pulse");
    }, 2000);
    return () => clearTimeout(timer);
  }, [highlightId]);

  return (
    <div className="max-w-sm mx-auto pb-32">
      {/* Course header */}
      <div className="mb-8">
        <p className="text-4xl mb-2">{courseEmoji}</p>
        <h1 className="text-2xl font-bold">{courseTitle}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {completedCount}/{totalCount} lessons completed
        </p>
        <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all"
            style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : "0%" }}
          />
        </div>
      </div>

      {/* Zigzag map */}
      <div className="flex flex-col">
        {lessons.map((lesson, index) => {
          const prevLesson = lessons[index - 1];
          const nextLesson = lessons[index + 1];
          const side: "left" | "right" = index % 2 === 0 ? "left" : "right";
          const showChapterHeader = lesson.chapterId !== prevLesson?.chapterId;
          const showConnector = index < lessons.length - 1;
          const connectorIsAmber = nextLesson?.type === "checkpoint";

          return (
            <div key={lesson.id}>
              {showChapterHeader && (
                <ChapterHeader title={lesson.chapterTitle} />
              )}

              <MapNode
                lesson={lesson}
                side={side}
                onClick={setSelectedLesson}
              />

              {showConnector && (
                <div className="flex justify-center" style={{ height: 40 }}>
                  <svg width="4" height="40" overflow="visible">
                    <motion.line
                      x1="2" y1="0" x2="2" y2="40"
                      stroke={connectorIsAmber ? "#fbbf24" : "#c4b5fd"}
                      strokeWidth={connectorIsAmber ? 3 : 2}
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4, delay: index * 0.08, ease: "easeOut" }}
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <LessonPreviewSheet
        lesson={selectedLesson}
        courseId={courseId}
        onClose={() => setSelectedLesson(null)}
      />
    </div>
  );
}
