import { Inngest, eventType, staticSchema } from "inngest";

export const inngest = new Inngest({ id: "learn-forge" });

export const documentUploaded = eventType("app/document.uploaded", {
  schema: staticSchema<{ documentId: string }>(),
});

export const courseCurriculumRequested = eventType("app/course.curriculum-requested", {
  schema: staticSchema<{ courseId: string }>(),
});

export const lessonExercisesRequested = eventType("app/lesson.exercises-requested", {
  schema: staticSchema<{ lessonId: string }>(),
});
