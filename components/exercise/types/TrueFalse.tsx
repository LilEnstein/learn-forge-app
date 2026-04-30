"use client";

interface Props {
  question: string;
  onSubmit: (answer: boolean) => void;
  disabled: boolean;
}

export function TrueFalse({ question, onSubmit, disabled }: Props) {
  return (
    <div className="space-y-6">
      <p className="text-xl font-semibold">{question}</p>
      <div className="grid grid-cols-2 gap-4">
        <button
          disabled={disabled}
          onClick={() => onSubmit(true)}
          className="py-6 rounded-xl border-2 border-green-300 bg-green-50 hover:bg-green-100 font-bold text-green-700 text-lg"
        >
          ✓ True
        </button>
        <button
          disabled={disabled}
          onClick={() => onSubmit(false)}
          className="py-6 rounded-xl border-2 border-red-300 bg-red-50 hover:bg-red-100 font-bold text-red-700 text-lg"
        >
          ✗ False
        </button>
      </div>
    </div>
  );
}
