"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useExercise, type ExerciseItem } from "@/hooks/useExercise";
import { useGamification } from "@/hooks/useGamification";
import { useMascot } from "@/hooks/useMascot";
import { MascotFloat } from "@/components/mascot/MascotFloat";
import { MascotOverlay } from "@/components/mascot/MascotOverlay";
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

  const { react, show } = useMascot();
  const errorCount = useRef(0);
  const [showPerfectOverlay, setShowPerfectOverlay] = useState(false);

  // Mascot: greet on mount
  useEffect(() => {
    show('top-down');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mascot: react to correct / incorrect answers
  useEffect(() => {
    if (!showFeedback || !lastResult) return;
    if (lastResult.correct) {
      react('correct');
    } else {
      errorCount.current++;
      react('incorrect');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFeedback, lastResult]);

  // Mascot: react on lesson complete
  useEffect(() => {
    if (!isComplete) return;
    if (errorCount.current === 0) {
      setShowPerfectOverlay(true);
      react('perfect');
    } else {
      react('lesson_complete');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  // Mascot: idle detection (5 minutes)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => react('idle'), 5 * 60 * 1000);
    };
    window.addEventListener('mousemove', reset);
    window.addEventListener('keydown', reset);
    window.addEventListener('touchstart', reset);
    reset();
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', reset);
      window.removeEventListener('keydown', reset);
      window.removeEventListener('touchstart', reset);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showNoHearts = hearts === 0 && !showFeedback && !isComplete;

  if (isComplete && lastResult) {
    return (
      <ResultScreen
        result={lastResult}
        courseId={courseId}
        chapterId={chapterId}
        chapterTitle={chapterTitle}
      />
    );
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

      <MascotFloat position="bottom-right" />

      <AnimatePresence>
        {showPerfectOverlay && (
          <MascotOverlay
            expression="victory"
            message="Hoàn hảo! +5 gems 💎"
            onClose={() => setShowPerfectOverlay(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
