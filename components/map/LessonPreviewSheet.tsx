"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import type { MapLesson } from "./MapNode";

interface Props {
  lesson: MapLesson | null;
  courseId: string;
  onClose: () => void;
}

export function LessonPreviewSheet({ lesson, courseId, onClose }: Props) {
  const router = useRouter();
  const isLocked = lesson?.status === "locked";

  function handleStart() {
    if (!lesson || isLocked) return;
    router.push(`/app/learn/${courseId}/lesson/${lesson.id}`);
  }

  return (
    <AnimatePresence>
      {lesson && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 bg-card rounded-t-2xl p-6 z-50 shadow-2xl max-w-2xl mx-auto"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Handle */}
            <div className="w-8 h-1 bg-muted rounded-full mx-auto mb-6" />

            {/* Lesson info */}
            <div className="flex items-start gap-4 mb-4">
              <div className="text-3xl">{lesson.type === "checkpoint" ? "🏆" : "📘"}</div>
              <div className="flex-1">
                <p className="font-bold text-lg leading-tight">{lesson.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {lesson.type === "checkpoint" ? "Checkpoint" : "Standard lesson"} · {lesson.exerciseCount} exercises
                </p>
              </div>
            </div>

            {/* Badges */}
            <div className="flex gap-2 mb-6">
              <span className="bg-violet-100 text-violet-700 text-xs font-semibold px-3 py-1 rounded-full">
                +{lesson.xpReward} XP
              </span>
              {lesson.type === "checkpoint" && (
                <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full">
                  Checkpoint
                </span>
              )}
              {lesson.status === "completed" && (
                <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                  ✓ Completed
                </span>
              )}
            </div>

            {/* Start button */}
            <button
              onClick={handleStart}
              disabled={isLocked}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {lesson.status === "completed" ? "Review Lesson" : "Start Lesson →"}
            </button>

            {isLocked && (
              <p className="text-xs text-muted-foreground text-center mt-3">
                Complete the previous lesson to unlock
              </p>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
