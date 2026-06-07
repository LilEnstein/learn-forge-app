import { prisma } from "@/lib/db/prisma";
import { parseBuffer } from "./parser";
import { isMarkItDownAvailable, convertWithMarkItDown } from "./markitdown";
import { chunkText } from "./chunker";
import { withFailover } from "@/lib/ai/with-failover";
import { inngest } from "@/lib/inngest/client";
import { progressEmitter } from "@/lib/progress-emitter";
import type { ProgressEvent } from "@/types/progress";

function emit(docId: string, event: Omit<ProgressEvent, "timestamp">) {
  progressEmitter.emit(docId, { ...event, timestamp: Date.now() });
}

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
    emit(documentId, { step: "upload", message: "Đã lưu tài liệu", progress: 5 });

    let text: string | null = null;
    let parserUsed: "markitdown" | "fallback" = "markitdown";

    if (await isMarkItDownAvailable()) {
      text = await convertWithMarkItDown(buffer, doc.name);
    }

    if (!text || text.trim().length < 100) {
      parserUsed = "fallback";
      const parsed = await parseBuffer(buffer, doc.name);
      text = parsed.text;
    }

    console.log(`[ingest] parsed via ${parserUsed}: ${text.length} chars`);

    if (!text || text.trim().length < 100) {
      throw new Error("Document is too short or unreadable");
    }

    const wordCount = text.split(/\s+/).filter(Boolean).length;
    emit(documentId, {
      step: "parse",
      message: `Đã đọc tài liệu (${parserUsed === "markitdown" ? "MarkItDown" : "trình đọc gốc"})`,
      detail: `${wordCount.toLocaleString("vi-VN")} từ`,
      progress: 15,
    });

    const chunks = chunkText(text);
    console.log(`[ingest] chunked: ${chunks.length} chunks`);

    if (chunks.length === 0) {
      throw new Error("No chunks produced");
    }

    emit(documentId, {
      step: "chunk",
      message: "Đã chia nhỏ nội dung",
      detail: `${chunks.length} chunks`,
      progress: 35,
    });

    await withFailover(doc.userId, "embedding", async (provider) => {
      const embed = provider.getEmbeddingModel("ingest");
      const BATCH_SIZE = 20;
      const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);

      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
        emit(documentId, {
          step: "embed",
          message: "Đang tạo vector embedding...",
          detail: `Batch ${batchIndex}/${totalBatches}`,
          progress: Math.round(35 + (batchIndex / totalBatches) * 60),
        });

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

    emit(documentId, {
      step: "done",
      message: "Tài liệu đã được xử lý xong!",
      progress: 100,
      courseId: doc.courseId ?? undefined,
    });
    progressEmitter.close(documentId);

    if (doc.courseId) {
      await checkAndTriggerCurriculum(doc.courseId);
    }
  } catch (err) {
    console.error("[ingest] error:", err);
    emit(documentId, {
      step: "error",
      message: err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định",
    });
    progressEmitter.close(documentId);
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
