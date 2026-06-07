import { prisma } from "@/lib/db/prisma";
import { progressEmitter } from "@/lib/progress-emitter";
import type { ProgressEvent } from "@/types/progress";

/**
 * The SSE progress stream is keyed by documentId (that's what the upload client
 * subscribes to). Curriculum/exercise stages only know the courseId, so resolve
 * the course's primary document and emit against it. Best-effort: never throw.
 */
export async function emitCourseProgress(
  courseId: string,
  event: Omit<ProgressEvent, "timestamp">
): Promise<void> {
  const doc = await prisma.document
    .findFirst({ where: { courseId }, orderBy: { createdAt: "asc" }, select: { id: true } })
    .catch(() => null);
  if (!doc) return;
  await progressEmitter.emit(doc.id, { ...event, timestamp: Date.now() });
}
