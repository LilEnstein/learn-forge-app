import { prisma } from "@/lib/db/prisma";
import { parseFile } from "./parser";
import { chunkText } from "./chunker";
import { withFailover } from "@/lib/ai/with-failover";

/**
 * Run the full RAG ingestion pipeline for one document:
 * parse → chunk → embed → write to pgvector → trigger curriculum if course is ready.
 */
export async function ingestDocument(documentId: string): Promise<void> {
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });

  // Idempotency — skip if already done
  if (doc.status === "ready") return;

  console.log(`[ingest] start: ${doc.name} (${doc.id})`);

  try {
    // 1. Parse → plain text (no AI needed)
    const parsed = await parseFile(doc.storagePath, doc.type);
    console.log(`[ingest] parsed: ${parsed.text.length} chars`);

    if (!parsed.text || parsed.text.trim().length < 100) {
      throw new Error("Document is too short or unreadable");
    }

    // 2. Chunk
    const chunks = chunkText(parsed.text);
    console.log(`[ingest] chunked: ${chunks.length} chunks`);

    if (chunks.length === 0) {
      throw new Error("No chunks produced");
    }

    // 3. Embed + insert (sequential to avoid rate-limiting; batched concurrently per BATCH_SIZE)
    // Wrap the entire embedding pass in withFailover so a 429 mid-document fails over.
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

    // 4. Mark ready
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "ready" },
    });
    console.log(`[ingest] done: ${doc.name}`);

    // 5. If part of a course and all docs ready → kick off curriculum generation
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

  // Fire-and-forget — don't block the worker
  import("@/lib/ai/generators/curriculum")
    .then(({ generateCurriculum }) =>
      generateCurriculum(courseId).catch((e) =>
        console.error("[ingest] curriculum generation failed:", e)
      )
    )
    .catch((e) => console.error("[ingest] failed to load curriculum module:", e));
}
