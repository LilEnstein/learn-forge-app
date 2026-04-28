import { prisma } from "@/lib/db/prisma";
import { storage } from "@/lib/storage";
import { chunkText } from "./chunker";
import { getEmbeddingModel } from "@/lib/ai/provider";
import { parsePdf } from "./parsers/pdf";
import { parseDocx } from "./parsers/docx";
import { parseText } from "./parsers/text";
import { parseUrl } from "./parsers/url";
import { parseYoutube } from "./parsers/youtube";

async function parseDocument(type: string, storagePath: string): Promise<string> {
  if (type === "url") return parseUrl(storagePath);
  if (type === "youtube") return parseYoutube(storagePath);

  const buffer = await storage.readFile(storagePath);
  if (type === "pdf") return parsePdf(buffer);
  if (type === "docx") return parseDocx(buffer);
  return parseText(buffer);
}

export async function ingestDocument(documentId: string): Promise<void> {
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });

  let rawText: string;
  try {
    rawText = await parseDocument(doc.type, doc.storagePath);
  } catch (err) {
    await prisma.document.update({ where: { id: documentId }, data: { status: "error" } });
    throw err;
  }

  const chunks = chunkText(rawText);
  if (chunks.length === 0) {
    await prisma.document.update({ where: { id: documentId }, data: { status: "error" } });
    throw new Error(`No text extracted from document ${documentId}`);
  }

  const embed = getEmbeddingModel();

  for (const chunk of chunks) {
    const embedding = await embed(chunk.content);
    const embeddingStr = `[${embedding.join(",")}]`;

    // Insert chunk with pgvector embedding via raw SQL
    const created = await prisma.documentChunk.create({
      data: { documentId, content: chunk.content, metadata: chunk.metadata },
      select: { id: true },
    });

    await prisma.$executeRaw`
      UPDATE "DocumentChunk"
      SET embedding = ${embeddingStr}::vector
      WHERE id = ${created.id}
    `;
  }

  await prisma.document.update({ where: { id: documentId }, data: { status: "ready" } });

  // If this document belongs to a course, check if all course documents are ready
  if (doc.courseId) {
    const pendingDocs = await prisma.document.count({
      where: { courseId: doc.courseId, status: { not: "ready" } },
    });
    if (pendingDocs === 0) {
      const { getBoss } = await import("@/lib/queue/boss");
      const boss = await getBoss();
      await boss.send("generate-curriculum", { courseId: doc.courseId });
    }
  }
}
