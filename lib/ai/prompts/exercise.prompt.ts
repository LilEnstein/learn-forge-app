export function buildExercisePrompt(params: {
  lessonTitle: string;
  topicKeywords: string[];
  chunks: string[];
}): { system: string; user: string } {
  const context = params.chunks.slice(0, 5).join("\n\n---\n\n");

  const system = `You are an expert educational content creator. Create quiz exercises based on provided content. You MUST respond with valid JSON only — no markdown, no explanation, no code fences.`;

  const user = `Create 3-5 exercises for the lesson: "${params.lessonTitle}"
Topic keywords: ${params.topicKeywords.join(", ")}

Source material:
${context}

Respond with a JSON array of exercise objects:
[
  {
    "type": "multiple_choice",
    "question": "string",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": "A",
    "explanation": "string",
    "difficulty": 1
  },
  {
    "type": "true_false",
    "question": "string (a statement to evaluate)",
    "correctAnswer": true,
    "explanation": "string",
    "difficulty": 1
  },
  {
    "type": "fill_blank",
    "question": "The ___ is responsible for... (use ___ for the blank)",
    "correctAnswer": "answer word or phrase",
    "explanation": "string",
    "difficulty": 2
  }
]

Rules:
- Mix exercise types (multiple_choice, true_false, fill_blank)
- All content must come strictly from the source material
- Difficulty: 1=easy, 2=medium, 3=hard
- multiple_choice MUST have exactly 4 options
- fill_blank questions MUST use ___ for the blank
- correctAnswer for multiple_choice must exactly match one of the options`;

  return { system, user };
}
