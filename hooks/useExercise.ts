"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export interface ExerciseItem {
  id: string;
  order: number;
  type: string;
  question: string;
  options: unknown;
  explanation: string | null;
  difficulty: number;
}

export interface NextLessonInfo {
  id: string;
  title: string;
  courseId: string;
  chapterId: string;
  chapterTitle: string;
}

export interface SubmitResult {
  correct: boolean;
  explanation: string | null;
  heartsRemaining: number;
  heartsExhausted?: boolean;
  xpEarned?: number;
  gemsEarned?: number;
  streakDay?: number;
  lessonComplete?: boolean;
  nextLesson?: NextLessonInfo | null;
}

export function useExercise(lessonId: string, exercises: ExerciseItem[]) {
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastResult, setLastResult] = useState<SubmitResult | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [hearts, setHearts] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const currentExercise = exercises[currentIndex] ?? null;

  async function submitAnswer(answer: unknown) {
    if (!currentExercise || submitting) return;
    setSubmitting(true);

    const res = await fetch(`/api/lessons/${lessonId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exerciseId: currentExercise.id,
        answer,
        timeSpentMs: 0,
      }),
    });

    const result: SubmitResult = await res.json();
    setLastResult(result);
    setHearts(result.heartsRemaining);
    setShowFeedback(true);
    setSubmitting(false);

    queryClient.invalidateQueries({ queryKey: ["gamification"] });

    if (result.lessonComplete) setIsComplete(true);
  }

  function advance() {
    setShowFeedback(false);
    setLastResult(null);
    if (!isComplete) setCurrentIndex((i) => Math.min(i + 1, exercises.length - 1));
  }

  return {
    currentExercise,
    currentIndex,
    totalExercises: exercises.length,
    lastResult,
    showFeedback,
    isComplete,
    hearts,
    submitting,
    submitAnswer,
    advance,
  };
}
