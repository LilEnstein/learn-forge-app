"use client";
import { useExercise, type ExerciseItem } from "@/hooks/useExercise";
import { useGamification } from "@/hooks/useGamification";
import { ProgressBar } from "./ProgressBar";
import { HeartDisplay } from "./HeartDisplay";
import { FeedbackOverlay } from "./FeedbackOverlay";
import { ResultScreen } from "./ResultScreen";
import { NoHeartsModal } from "@/components/gamification/NoHeartsModal";
import { MultipleChoice } from "./types/MultipleChoice";
import { TrueFalse } from "./types/TrueFalse";
import { FillBlank } from "./types/FillBlank";
import { Matching } from "./types/Matching";
import { Ordering } from "./types/Ordering";
import { CodeFillBlank } from "./types/CodeFillBlank";

interface Props {
  lessonId: string;
  courseId: string;
  chapterId: string;
  chapterTitle: string;
  exercises: ExerciseItem[];
}

export function ExerciseScreen({ lessonId, courseId, chapterId, chapterTitle, exercises }: Props) {
  const { data: gamification } = useGamification();
  const {
    currentExercise,
    currentIndex,
    totalExercises,
    lastResult,
    showFeedback,
    isComplete,
    hearts,
    submitting,
    submitAnswer,
    advance,
  } = useExercise(lessonId, exercises);

  const showNoHearts = hearts === 0 && !showFeedback && !isComplete;

  if (isComplete && lastResult) {
    return <ResultScreen result={lastResult} courseId={courseId} />;
  }

  if (!currentExercise) return null;

  const opts = currentExercise.options as Record<string, unknown> | null;

  function renderExercise() {
    const ex = currentExercise!;
    switch (ex.type) {
      case "multiple_choice":
        return (
          <MultipleChoice
            question={ex.question}
            options={(ex.options as string[]) ?? []}
            onSubmit={submitAnswer}
            disabled={submitting || showFeedback}
          />
        );
      case "true_false":
        return (
          <TrueFalse
            question={ex.question}
            onSubmit={submitAnswer}
            disabled={submitting || showFeedback}
          />
        );
      case "fill_blank":
        return (
          <FillBlank
            question={ex.question}
            onSubmit={submitAnswer}
            disabled={submitting || showFeedback}
          />
        );
      case "matching":
        return (
          <Matching
            question={ex.question}
            options={opts as { pairs: { left: string; right: string }[] }}
            onSubmit={submitAnswer}
            disabled={submitting || showFeedback}
          />
        );
      case "ordering":
        return (
          <Ordering
            question={ex.question}
            options={(ex.options as string[]) ?? []}
            onSubmit={submitAnswer}
            disabled={submitting || showFeedback}
          />
        );
      case "code_fill_blank":
        return (
          <CodeFillBlank
            question={ex.question}
            onSubmit={submitAnswer}
            disabled={submitting || showFeedback}
          />
        );
      default:
        return <p className="text-muted-foreground">Unknown exercise type: {ex.type}</p>;
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-32">
      <div className="flex items-center justify-between gap-4">
        <ProgressBar current={currentIndex} total={totalExercises} />
        <HeartDisplay hearts={hearts} maxHearts={gamification?.maxHearts ?? 5} />
      </div>

      <div key={currentExercise.id}>
        {renderExercise()}
      </div>

      {showFeedback && lastResult && (
        <FeedbackOverlay
          correct={lastResult.correct}
          explanation={lastResult.explanation}
          onContinue={advance}
        />
      )}

      {showNoHearts && (
        <NoHeartsModal
          gemsBalance={gamification?.gems ?? 0}
          onUseGems={async () => {
            await fetch("/api/gamification/shop", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ item: "heart_refill" }),
            });
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
