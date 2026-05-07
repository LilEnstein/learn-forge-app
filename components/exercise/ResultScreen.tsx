"use client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { SubmitResult } from "@/hooks/useExercise";

interface Props {
  result: SubmitResult;
  courseId: string;
  chapterId: string;
  chapterTitle: string;
}

const CONFETTI_COLORS = ["#7c3aed", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#ec4899"];

function Confetti() {
  const count = 24;
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * 360;
        const distance = 160 + (i % 3) * 60;
        const rad = (angle * Math.PI) / 180;
        return (
          <motion.div
            key={i}
            className="absolute w-3 h-3 rounded-sm"
            style={{
              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              left: "50%",
              top: "40%",
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(rad) * distance,
              y: Math.sin(rad) * distance,
              opacity: 0,
              scale: 0,
              rotate: angle * 2,
            }}
            transition={{ duration: 1.5, delay: i * 0.04, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}

export function ResultScreen({ result, courseId, chapterId, chapterTitle }: Props) {
  const router = useRouter();
  const { nextLesson } = result;
  // nextLesson is null (explicitly) when course is complete; undefined means API didn't include it (idempotent path)
  const isCourseComplete = nextLesson === null;
  const isChapterBoundary = !!nextLesson && nextLesson.chapterId !== chapterId;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      {isCourseComplete && <Confetti />}

      <div className="text-6xl">{isCourseComplete ? "🏆" : "🎉"}</div>

      <h2 className="text-2xl font-bold">
        {isCourseComplete ? "Bạn đã hoàn thành khóa học!" : "Bài học hoàn thành!"}
      </h2>

      {isChapterBoundary && (
        <div className="px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-sm font-semibold">
          ✓ Hoàn thành {chapterTitle}
        </div>
      )}

      <div className="flex gap-6">
        <div>
          <p className="text-3xl font-bold text-violet-600">+{result.xpEarned ?? 0} XP</p>
          <p className="text-sm text-muted-foreground">XP earned</p>
        </div>
        {(result.gemsEarned ?? 0) > 0 && (
          <div>
            <p className="text-3xl font-bold text-yellow-500">+{result.gemsEarned} 💎</p>
            <p className="text-sm text-muted-foreground">Gems</p>
          </div>
        )}
        <div>
          <p className="text-3xl font-bold text-orange-500">🔥 {result.streakDay ?? 1}</p>
          <p className="text-sm text-muted-foreground">Day streak</p>
        </div>
      </div>

      {nextLesson && (
        <div className="text-sm text-muted-foreground">
          Bài tiếp theo: <span className="font-medium text-foreground">📘 {nextLesson.title}</span>
        </div>
      )}

      <div className="flex gap-3 mt-2">
        <button
          onClick={() => router.push("/app/dashboard")}
          className="px-6 py-3 border border-border rounded-xl font-semibold text-sm hover:bg-muted transition-colors"
        >
          ← Dashboard
        </button>

        {isCourseComplete ? (
          <button
            onClick={() => router.push(`/app/learn/${courseId}`)}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-sm transition-colors"
          >
            Xem kết quả khóa học 🏆
          </button>
        ) : nextLesson ? (
          <button
            onClick={() =>
              router.push(`/app/learn/${nextLesson.courseId}?highlight=${nextLesson.id}`)
            }
            className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-sm transition-colors"
          >
            Bài tiếp theo →
          </button>
        ) : null}
      </div>
    </div>
  );
}
