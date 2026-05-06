import { prisma } from "@/lib/db/prisma";
import { parseBuffer } from "./parser";
import { chunkText } from "./chunker";
import { withFailover } from "@/lib/ai/with-failover";
import { inngest } from "@/lib/inngest/client";

/**
 * Run the full RAG ingestion pipeline for one document:
 * fetch from blob → parse → chunk → embed → write to pgvector → enqueue curriculum if course is ready.
 */
export async function ingestDocument(documentId: string): Promise<void> {
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });

  if (doc.status === "ready") return;

  console.log(`[ingest] start: ${doc.name} (${doc.id})`);

  try {
    const buffer = await fetchStorage(doc.storagePath);
    const parsed = await parseBuffer(buffer, doc.name);
    console.log(`[ingest] parsed: ${parsed.text.length} chars`);

    if (!parsed.text || parsed.text.trim().length < 100) {
      throw new Error("Document is too short or unreadable");
    }

    const chunks = chunkText(parsed.text);
    console.log(`[ingest] chunked: ${chunks.length} chunks`);

    if (chunks.length === 0) {
      throw new Error("No chunks produced");
    }

    await withFailover(doc.userId, "embedding", async (provider) => {
      const embed = provider.getEmbeddingModel("ingest");
      const BATCH_SIZE = 5;

      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (chunk) => {
            const embedding = await embed(chunk.content);
            const embStr = `[${embedding.join(",")}]`;

            const created = await prisma.documentChunk.create({
              data: {
                documentId,
                content: chunk.content,
                metadata: {
                  index: chunk.index,
                  charStart: chunk.charStart,
                  charEnd: chunk.charEnd,
                },
              },
              select: { id: true },
            });

            await prisma.$executeRaw`
              UPDATE "DocumentChunk"
              SET embedding = ${embStr}::vector
              WHERE id = ${created.id}
            `;
          })
        );
        console.log(
          `[ingest] embedded ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length}`
        );
      }
    });

    await prisma.document.update({
      where: { id: documentId },
      data: { status: "ready" },
    });
    console.log(`[ingest] done: ${doc.name}`);

    if (doc.courseId) {
      await checkAndTriggerCurriculum(doc.courseId);
    }
  } catch (err) {
    console.error("[ingest] error:", err);
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "error" },
    });
    throw err;
  }
}

/**
 * Fetch a document from storage. Supports Vercel Blob URLs (production)
 * and local filesystem paths (legacy/dev fallback for documents uploaded
 * before the Blob migration).
 */
async function fetchStorage(storagePath: string): Promise<Buffer> {
  if (/^https?:\/\//.test(storagePath)) {
    const res = await fetch(storagePath);
    if (!res.ok) throw new Error(`Failed to fetch blob (${res.status}): ${storagePath}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const fs = await import("fs/promises");
  return fs.readFile(storagePath);
}

async function checkAndTriggerCurriculum(courseId: string): Promise<void> {
  const docs = await prisma.document.findMany({
    where: { courseId },
    select: { status: true },
  });

  const allReady = docs.length >= 1 && docs.every((d) => d.status === "ready");
  if (!allReady) return;

  console.log(`[ingest] all docs ready for course ${courseId} — triggering curriculum`);

  await prisma.course.update({
    where: { id: courseId },
    data: { status: "generating" },
  });

  await inngest.send({
    name: "app/course.curriculum-requested",
    data: { courseId },
  });
}
