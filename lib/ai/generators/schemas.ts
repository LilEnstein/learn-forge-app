import { z } from "zod";

const LessonSchema = z.object({
  title: z.string().min(1),
  topic_keywords: z.array(z.string()).min(1),
  type: z.enum(["standard", "checkpoint"]).default("standard"),
});

const ChapterSchema = z.object({
  title: z.string().min(1),
  lessons: z.array(LessonSchema).min(1),
});

export const CurriculumSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  emoji: z.string().default("📚"),
  chapters: z.array(ChapterSchema).min(1),
});

export type Curriculum = z.infer<typeof CurriculumSchema>;

export const ExerciseSchema = z.object({
  type: z.enum(["multiple_choice", "fill_blank", "true_false"]),
  question: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctAnswer: z.union([z.string(), z.array(z.string()), z.boolean()]),
  explanation: z.string().optional(),
  difficulty: z.number().int().min(1).max(3).default(1),
  language: z.string().optional(), // for code_fill_blank: "javascript" | "python" | "sql" | "typescript" | "bash"
});

export const ExercisesArraySchema = z.array(ExerciseSchema).min(1).max(10);

export type Exercise = z.infer<typeof ExerciseSchema>;
