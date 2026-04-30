"use client";
import { useRouter } from "next/navigation";
import type { SubmitResult } from "@/hooks/useExercise";

interface Props {
  result: SubmitResult;
  courseId: string;
}

export function ResultScreen({ result, courseId }: Props) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <div className="text-6xl">🎉</div>
      <h2 className="text-2xl font-bold">Lesson Complete!</h2>
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
      <button
        onClick={() => router.push(`/app/dashboard`)}
        className="mt-4 px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold"
      >
        Continue
      </button>
    </div>
  );
}
