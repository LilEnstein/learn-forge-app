"use client";

import { useState } from "react";
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
}

export function LearningMap({ lessons, courseId, courseEmoji, courseTitle, completedCount, totalCount }: Props) {
  const [selectedLesson, setSelectedLesson] = useState<MapLesson | null>(null);

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
                <div
                  className={`mx-auto rounded-full ${connectorIsAmber ? "bg-amber-400" : "bg-violet-300"}`}
                  style={{ width: connectorIsAmber ? 3 : 2, height: 32 }}
                />
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
