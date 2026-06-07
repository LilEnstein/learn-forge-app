import { inngest } from "@/lib/inngest/client";

/**
 * The three background events the app fires, and the data each carries.
 * These mirror the Inngest event names (production) and map 1:1 to the
 * pg-boss queue names registered in lib/queue/workers.ts (local dev).
 */
type JobEvent =
  | { name: "app/document.uploaded"; data: { documentId: string } }
  | { name: "app/course.curriculum-requested"; data: { courseId: string } }
  | { name: "app/lesson.exercises-requested"; data: { lessonId: string } };

const EVENT_TO_QUEUE: Record<JobEvent["name"], string> = {
  "app/document.uploaded": "ingest-document",
  "app/course.curriculum-requested": "generate-curriculum",
  "app/lesson.exercises-requested": "generate-exercises",
};

// Local dev uses pg-boss workers (started in instrumentation.ts when not on
// Vercel). Production uses Vercel Blob storage + Inngest. We key off the same
// STORAGE_PROVIDER knob the storage layer uses so both move together.
function isLocal(): boolean {
  return (process.env.STORAGE_PROVIDER ?? "local") !== "vercel-blob";
}

/**
 * Enqueue a background job. On local dev this goes to pg-boss; in production
 * it goes to Inngest. Accepts one event or an array (e.g. fan-out for exercises).
 */
export async function dispatchJob(events: JobEvent | JobEvent[]): Promise<void> {
  const list = Array.isArray(events) ? events : [events];

  if (isLocal()) {
    const { sendJob } = await import("./boss");
    await Promise.all(list.map((e) => sendJob(EVENT_TO_QUEUE[e.name], e.data)));
    return;
  }

  await inngest.send(list);
}
