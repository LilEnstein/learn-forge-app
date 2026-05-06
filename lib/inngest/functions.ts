import {
  inngest,
  documentUploaded,
  courseCurriculumRequested,
  lessonExercisesRequested,
} from "./client";

export const ingestDocumentFn = inngest.createFunction(
  {
    id: "ingest-document",
    triggers: [documentUploaded],
    retries: 3,
  },
  async ({ event, step }) => {
    const { documentId } = event.data;
    await step.run("ingest", async () => {
      const { ingestDocument } = await import("@/lib/upload/ingest");
      await ingestDocument(documentId);
    });
  }
);

export const generateCurriculumFn = inngest.createFunction(
  {
    id: "generate-curriculum",
    triggers: [courseCurriculumRequested],
    retries: 2,
  },
  async ({ event, step }) => {
    const { courseId } = event.data;
    await step.run("generate", async () => {
      const { generateCurriculum } = await import("@/lib/ai/generators/curriculum");
      await generateCurriculum(courseId);
    });
  }
);

export const generateExercisesFn = inngest.createFunction(
  {
    id: "generate-exercises",
    triggers: [lessonExercisesRequested],
    retries: 2,
    concurrency: { limit: 4 },
  },
  async ({ event, step }) => {
    const { lessonId } = event.data;
    await step.run("generate", async () => {
      const { generateExercises } = await import("@/lib/ai/generators/exercises");
      await generateExercises(lessonId);
    });
  }
);

export const functions = [ingestDocumentFn, generateCurriculumFn, generateExercisesFn];
