export function buildCurriculumPrompt(params: {
  chunks: string[];
  courseTitle: string;
  topic: string;
}): { system: string; user: string } {
  const context = params.chunks.slice(0, 20).join("\n\n---\n\n");

  const system = `You are an expert curriculum designer. Your task is to create a structured learning curriculum from provided content. You MUST respond with valid JSON only — no markdown, no explanation, no code fences.`;

  const user = `Create a learning curriculum for the topic: "${params.topic}" (course title: "${params.courseTitle}").

Use the following content as your source material:

${context}

Respond with a JSON object that matches this exact structure:
{
  "title": "string",
  "description": "string (2-3 sentence course overview)",
  "emoji": "single emoji that represents the topic",
  "chapters": [
    {
      "title": "string",
      "lessons": [
        {
          "title": "string",
          "topic_keywords": ["keyword1", "keyword2", "keyword3"],
          "type": "standard"
        }
      ]
    }
  ]
}

Requirements:
- Create 3-5 chapters
- Each chapter should have 3-5 lessons
- topic_keywords must be specific terms from the source material (minimum 3 keywords per lesson)
- Every 3rd lesson in each chapter should be type "checkpoint" for review
- Titles must be clear, specific, and educational
- Base all content strictly on the provided source material`;

  return { system, user };
}
