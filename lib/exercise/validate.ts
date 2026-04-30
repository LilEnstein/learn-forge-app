type ExerciseRecord = {
  type: string;
  correctAnswer: unknown;
};

export function validateAnswer(exercise: ExerciseRecord, answer: unknown): boolean {
  const correct = exercise.correctAnswer;

  switch (exercise.type) {
    case "multiple_choice":
    case "true_false":
      return answer === correct;

    case "fill_blank":
      return (
        typeof answer === "string" &&
        answer.trim().toLowerCase() === String(correct).trim().toLowerCase()
      );

    case "ordering": {
      if (!Array.isArray(answer) || !Array.isArray(correct)) return false;
      if (answer.length !== (correct as unknown[]).length) return false;
      return (answer as unknown[]).every((v, i) => v === (correct as unknown[])[i]);
    }

    case "matching": {
      if (!Array.isArray(answer) || !Array.isArray(correct)) return false;
      type Pair = { left: string; right: string };
      const toKey = (p: Pair) => `${p.left}::${p.right}`;
      const correctSet = new Set((correct as Pair[]).map(toKey));
      const answerPairs = answer as Pair[];
      if (answerPairs.length !== correctSet.size) return false;
      return answerPairs.every((p) => correctSet.has(toKey(p)));
    }

    case "code_fill_blank":
      return (
        typeof answer === "string" &&
        answer.replace(/\s+/g, " ").trim() ===
          String(correct).replace(/\s+/g, " ").trim()
      );

    default:
      return false;
  }
}
