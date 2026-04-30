interface Props {
  correct: boolean;
  explanation: string | null;
  onContinue: () => void;
}

export function FeedbackOverlay({ correct, explanation, onContinue }: Props) {
  return (
    <div
      className={`fixed bottom-0 left-0 right-0 p-6 border-t-4 ${
        correct ? "bg-green-50 border-green-500" : "bg-red-50 border-red-500"
      }`}
    >
      <div className="max-w-2xl mx-auto space-y-3">
        <p className={`font-bold text-lg ${correct ? "text-green-700" : "text-red-700"}`}>
          {correct ? "✓ Correct!" : "✗ Incorrect"}
        </p>
        {explanation && <p className="text-sm text-muted-foreground">{explanation}</p>}
        <button
          onClick={onContinue}
          className={`w-full py-3 rounded-xl font-semibold text-white ${
            correct ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
